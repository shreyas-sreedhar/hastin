import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@hastin/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCRIPT_TO_COLUMN = {
  sa: "block_content",
  iast: "iast_text",
  en: "translation",
} as const;
type Script = keyof typeof SCRIPT_TO_COLUMN;
const ALL_SCRIPTS: Script[] = ["sa", "iast", "en"];

const SNIPPET_WINDOW = 80;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_QUERY_LEN = 2;

const RequestSchema = z.object({
  q: z.string().min(MIN_QUERY_LEN, `query must be at least ${MIN_QUERY_LEN} characters`),
  limit: z.number().int().positive().max(MAX_LIMIT).optional(),
  scripts: z.array(z.enum(["sa", "iast", "en"])).nonempty().optional(),
});

type SearchHit = {
  block_id: string;
  document_id: string;
  page_id: string | null;
  page_number: number | null;
  block_type: string;
  block_order: number;
  matched: Script[];
  snippets: Partial<Record<Script, string>>;
};

function snippet(text: string | null, query: string): string | null {
  if (!text) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - SNIPPET_WINDOW);
  const end = Math.min(text.length, idx + query.length + SNIPPET_WINDOW);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { q, limit = DEFAULT_LIMIT, scripts = ALL_SCRIPTS } = parsed.data;
  const sql = getDb();
  const pattern = `%${q}%`;

  // Build an OR across requested columns. Same parameter ($1) is reused —
  // postgres.js handles this through its tagged-template binding API.
  const columns = scripts.map((s) => SCRIPT_TO_COLUMN[s]);

  const rows = await sql.unsafe<
    Array<{
      id: string;
      document_id: string;
      page_id: string | null;
      page_number: number | null;
      block_type: string;
      block_order: number;
      block_content: string;
      iast_text: string | null;
      translation: string | null;
    }>
  >(
    `
      SELECT id, document_id, page_id, page_number, block_type, block_order,
             block_content, iast_text, translation
      FROM blocks
      WHERE ${columns.map((c) => `${c} ILIKE $1`).join(" OR ")}
      ORDER BY block_order
      LIMIT $2
    `,
    [pattern, limit],
  );

  const results: SearchHit[] = rows.map((r) => {
    const matched: Script[] = [];
    const snippets: Partial<Record<Script, string>> = {};
    for (const s of scripts) {
      const value =
        s === "sa" ? r.block_content : s === "iast" ? r.iast_text : r.translation;
      const sn = snippet(value, q);
      if (sn !== null) {
        matched.push(s);
        snippets[s] = sn;
      }
    }
    return {
      block_id: r.id,
      document_id: r.document_id,
      page_id: r.page_id,
      page_number: r.page_number,
      block_type: r.block_type,
      block_order: r.block_order,
      matched,
      snippets,
    };
  });

  return NextResponse.json({
    query: q,
    total: results.length,
    results,
  });
}
