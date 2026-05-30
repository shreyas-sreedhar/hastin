"use client";

import { useState } from "react";

export type ReaderBlock = {
  id: string;
  block_type: string;
  block_order: number;
  block_content: string;
  iast_text: string | null;
  translation: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  verse: "verse",
  prose: "prose",
  heading: "heading",
  footnote: "footnote",
  image: "image",
};

export function Reader({
  documentTitle,
  pageNumber,
  blocks,
}: {
  documentTitle: string;
  pageNumber: number;
  blocks: ReaderBlock[];
}) {
  const [showIast, setShowIast] = useState(false);
  const [showEnglish, setShowEnglish] = useState(true);

  return (
    <section className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur border-b border-stone-200 px-8 py-5 flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-500">
            {documentTitle}
          </p>
          <h2 className="text-2xl font-serif text-stone-900 mt-1">
            Page {pageNumber}
          </h2>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showIast}
              onChange={(e) => setShowIast(e.target.checked)}
              className="accent-stone-800"
            />
            <span className={showIast ? "text-stone-900" : "text-stone-500"}>
              IAST
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showEnglish}
              onChange={(e) => setShowEnglish(e.target.checked)}
              className="accent-stone-800"
            />
            <span className={showEnglish ? "text-stone-900" : "text-stone-500"}>
              English
            </span>
          </label>
        </div>
      </header>

      <div className="px-8 py-8 max-w-3xl">
        {blocks.length === 0 ? (
          <p className="text-stone-500 italic">
            This page hasn’t been OCR’d or block-detected yet.
          </p>
        ) : (
          <ol className="space-y-8">
            {blocks.map((b) => (
              <li key={b.id} className="border-l-2 border-stone-200 pl-5">
                <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-2">
                  {TYPE_LABEL[b.block_type] ?? b.block_type}
                </div>

                <div className="font-serif text-lg leading-relaxed text-stone-900 whitespace-pre-line">
                  {b.block_content}
                </div>

                {showIast && b.iast_text && (
                  <div className="mt-3 font-serif italic text-base leading-relaxed text-stone-600 whitespace-pre-line">
                    {b.iast_text}
                  </div>
                )}

                {showEnglish && b.translation && (
                  <div className="mt-3 text-base leading-relaxed text-stone-700 whitespace-pre-line">
                    {b.translation}
                  </div>
                )}

                {showEnglish && !b.translation && (
                  <div className="mt-3 text-xs italic text-stone-400">
                    No translation yet.
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
