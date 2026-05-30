import { NextRequest, NextResponse } from "next/server";
import { stat, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Repo root is three levels up from apps/web/app/api/storage/[...key]/route.ts
// when running, but Next.js resolves __dirname differently in dev vs build.
// Walk up from cwd until we find pnpm-workspace.yaml — robust to both.
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    try {
      // existsSync is fine here, but we already import async fs — keep it sync via require would mix styles.
      // statSync is sync and minimal.
      const path = join(dir, "pnpm-workspace.yaml");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs");
      if (fs.existsSync(path)) return dir;
    } catch {
      // continue
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  // fall back to cwd
  return process.cwd();
}

const STORAGE_ROOT = resolve(findRepoRoot(), "storage");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string[] } },
) {
  // Reconstruct the key
  const key = params.key.join("/");
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";

  // Support Cloudflare R2 in production
  if (process.env.STORAGE_BACKEND === "r2") {
    const r2PublicUrl = process.env.R2_PUBLIC_URL;
    if (!r2PublicUrl) {
      return NextResponse.json(
        { error: "R2_PUBLIC_URL is not configured" },
        { status: 500 },
      );
    }

    try {
      const url = `${r2PublicUrl}/${key}`;
      const res = await fetch(url);
      if (!res.ok) {
        return NextResponse.json({ error: "not found in R2" }, { status: 404 });
      }

      const data = await res.arrayBuffer();
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "content-type": res.headers.get("content-type") ?? mime,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch (err) {
      console.error("R2 storage fetch error:", err);
      return NextResponse.json(
        { error: "failed to retrieve file from R2" },
        { status: 500 },
      );
    }
  }

  // Refuse anything trying to escape STORAGE_ROOT
  const absolute = resolve(STORAGE_ROOT, key);
  if (!absolute.startsWith(STORAGE_ROOT + "/") && absolute !== STORAGE_ROOT) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const s = await stat(absolute);
    if (!s.isFile()) {
      return NextResponse.json({ error: "not a file" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const data = await readFile(absolute);

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": mime,
      "cache-control": "private, max-age=3600",
    },
  });
}
