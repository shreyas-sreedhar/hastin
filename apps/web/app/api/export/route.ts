import { NextResponse } from "next/server";
import { getDb } from "@hastin/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportBlock {
  id: string;
  block_type: string;
  block_order: number;
  content_sanskrit: string;
  content_iast: string | null;
  content_english: string | null;
}

interface ExportPage {
  page_number: number;
  dimensions: string | null;
  blocks: ExportBlock[];
}

export async function GET() {
  const sql = getDb();

  try {
    // 1. Fetch all documents, pages, and blocks
    const docs = await sql<Array<{ id: string; title: string; source_pdf: string | null; created_at: Date }>>`
      SELECT id, title, source_pdf, created_at 
      FROM documents 
      ORDER BY title
    `;

    const pages = await sql<Array<{ 
      id: string; 
      document_id: string; 
      page_number: number; 
      width: number | null; 
      height: number | null; 
      created_at: Date 
    }>>`
      SELECT id, document_id, page_number, width, height, created_at 
      FROM pages 
      ORDER BY document_id, page_number
    `;

    const blocks = await sql<Array<{ 
      id: string; 
      page_id: string | null; 
      block_type: string; 
      block_order: number; 
      block_content: string; 
      iast_text: string | null; 
      translation: string | null 
    }>>`
      SELECT id, page_id, block_type, block_order, block_content, iast_text, translation 
      FROM blocks 
      ORDER BY document_id, page_number, block_order
    `;

    // 2. Build hierarchical structure
    const pageMap = new Map<string, ExportPage>();
    for (const p of pages) {
      pageMap.set(p.id, {
        page_number: p.page_number,
        dimensions: p.width && p.height ? `${p.width}x${p.height}` : null,
        blocks: [],
      });
    }

    for (const b of blocks) {
      if (b.page_id && pageMap.has(b.page_id)) {
        const pg = pageMap.get(b.page_id);
        if (pg) {
          pg.blocks.push({
            id: b.id,
            block_type: b.block_type,
            block_order: b.block_order,
            content_sanskrit: b.block_content,
            content_iast: b.iast_text,
            content_english: b.translation,
          });
        }
      }
    }

    const docPagesMap = new Map<string, ExportPage[]>();
    for (const pg of Array.from(pageMap.values())) {
      // Find which document this page belongs to
      const pRecord = pages.find((p) => p.page_number === pg.page_number);
      if (pRecord) {
        const list = docPagesMap.get(pRecord.document_id) || [];
        list.push(pg);
        docPagesMap.set(pRecord.document_id, list);
      }
    }

    const corpusExport = docs.map((d) => ({
      id: d.id,
      title: d.title,
      source_pdf: d.source_pdf,
      created_at: d.created_at.toISOString(),
      pages: docPagesMap.get(d.id) || [],
    }));

    const payload = {
      platform: "Hastin",
      version: "1.0.0",
      description: "Complete digitized corpus export of the Hastyayurveda, including Sanskrit text, IAST transliterations, and English translations.",
      exported_at: new Date().toISOString(),
      corpus: corpusExport,
    };

    // 3. Set headers for attachment download
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="hastin-corpus-export.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Export API error:", err);
    return NextResponse.json({ error: "Failed to export corpus data" }, { status: 500 });
  }
}
