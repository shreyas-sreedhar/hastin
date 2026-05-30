import { notFound } from "next/navigation";
import { getDb } from "@hastin/db";

import { Navigation, type NavPage } from "@/components/reader/Navigation";
import { Reader, type ReaderBlock } from "@/components/reader/Reader";
import { Source, type SourcePageMeta } from "@/components/reader/Source";

export const dynamic = "force-dynamic";

type Params = { doc: string; page: string };

async function loadReaderData(documentTitle: string, pageNumber: number) {
  const sql = getDb();

  const docs = await sql<Array<{ id: string }>>`
    SELECT id FROM documents WHERE title = ${documentTitle} LIMIT 1
  `;
  if (docs.length === 0) return null;
  const documentId = docs[0].id;

  const navRows = await sql<Array<NavPage>>`
    SELECT p.page_number,
           EXISTS(SELECT 1 FROM blocks b WHERE b.page_id = p.id) AS has_blocks
    FROM pages p
    WHERE p.document_id = ${documentId}
    ORDER BY p.page_number
  `;

  const pageRows = await sql<
    Array<{
      id: string;
      storage_backend: string;
      storage_key: string;
      width: number | null;
      height: number | null;
      ocr_status: string | null;
    }>
  >`
    SELECT p.id, p.storage_backend, p.storage_key, p.width, p.height,
           o.status AS ocr_status
    FROM pages p
    LEFT JOIN ocr_pages o ON o.page_id = p.id
    WHERE p.document_id = ${documentId} AND p.page_number = ${pageNumber}
    LIMIT 1
  `;
  if (pageRows.length === 0) return null;
  const pg = pageRows[0];

  const blocks = await sql<Array<ReaderBlock>>`
    SELECT id, block_type, block_order, block_content, iast_text, translation
    FROM blocks
    WHERE page_id = ${pg.id}
    ORDER BY block_order
  `;

  const meta: SourcePageMeta = {
    storage_key: pg.storage_key,
    width: pg.width,
    height: pg.height,
    ocr_status: pg.ocr_status,
    block_count: blocks.length,
  };

  return { documentId, nav: navRows, blocks, meta };
}

export default async function ReadPage({ params }: { params: Params }) {
  const documentTitle = decodeURIComponent(params.doc);
  const pageNumber = Number.parseInt(params.page, 10);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const data = await loadReaderData(documentTitle, pageNumber);
  if (!data) notFound();

  return (
    <div className="h-screen grid grid-cols-1 md:grid-cols-[280px_1fr_360px]">
      <Navigation
        documentTitle={documentTitle}
        pages={data.nav}
        currentPage={pageNumber}
      />
      <Reader
        documentTitle={documentTitle}
        pageNumber={pageNumber}
        blocks={data.blocks}
      />
      <Source pageNumber={pageNumber} meta={data.meta} />
    </div>
  );
}
