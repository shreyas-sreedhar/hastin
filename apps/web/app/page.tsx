import { redirect } from "next/navigation";
import { getDb } from "@hastin/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sql = getDb();
  const rows = await sql<Array<{ title: string; page_number: number }>>`
    SELECT d.title, MIN(p.page_number) AS page_number
    FROM documents d
    JOIN pages p ON p.document_id = d.id
    GROUP BY d.title
    ORDER BY d.title
    LIMIT 1
  `;
  if (rows.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-12 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-serif mb-3">Hastin</h1>
          <p className="text-stone-600">
            No documents have been ingested yet. Run the extraction
            pipeline to populate the corpus.
          </p>
        </div>
      </div>
    );
  }
  const { title, page_number } = rows[0];
  redirect(`/read/${encodeURIComponent(title)}/${page_number}`);
}
