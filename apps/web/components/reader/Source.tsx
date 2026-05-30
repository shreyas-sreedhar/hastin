import Image from "next/image";

export type SourcePageMeta = {
  storage_key: string;
  width: number | null;
  height: number | null;
  ocr_status: string | null;
  block_count: number;
};

export function Source({
  pageNumber,
  meta,
}: {
  pageNumber: number;
  meta: SourcePageMeta;
}) {
  const src = `/api/storage/${meta.storage_key}`;
  const w = meta.width ?? 1500;
  const h = meta.height ?? 2100;

  return (
    <aside className="h-full overflow-y-auto border-l border-stone-200 bg-stone-100">
      <div className="px-5 py-6 border-b border-stone-200">
        <p className="text-xs uppercase tracking-widest text-stone-500">Source</p>
        <h3 className="mt-1 text-base font-serif text-stone-900">
          Page {pageNumber}
        </h3>
      </div>

      <div className="p-5">
        <div className="bg-white rounded shadow-sm overflow-hidden border border-stone-200">
          <Image
            src={src}
            alt={`Page ${pageNumber} scan`}
            width={w}
            height={h}
            unoptimized
            sizes="320px"
            className="w-full h-auto block"
          />
        </div>

        <dl className="mt-5 text-sm grid grid-cols-[100px_1fr] gap-y-2">
          <dt className="text-stone-500">Dimensions</dt>
          <dd className="text-stone-800">
            {meta.width ?? "?"} × {meta.height ?? "?"} px
          </dd>
          <dt className="text-stone-500">OCR</dt>
          <dd className="text-stone-800">{meta.ocr_status ?? "—"}</dd>
          <dt className="text-stone-500">Blocks</dt>
          <dd className="text-stone-800">{meta.block_count}</dd>
        </dl>

        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-block text-xs uppercase tracking-widest text-stone-500 hover:text-stone-800"
        >
          Open full image →
        </a>
      </div>
    </aside>
  );
}
