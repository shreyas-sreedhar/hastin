import Link from "next/link";

export type NavPage = {
  page_number: number;
  has_blocks: boolean;
};

export function Navigation({
  documentTitle,
  pages,
  currentPage,
}: {
  documentTitle: string;
  pages: NavPage[];
  currentPage: number;
}) {
  return (
    <nav className="h-full overflow-y-auto border-r border-stone-200 bg-stone-50">
      <div className="px-5 py-6 border-b border-stone-200">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-800"
        >
          Hastin
        </Link>
        <h1 className="mt-2 text-lg font-serif text-stone-900">{documentTitle}</h1>
        <p className="mt-1 text-xs text-stone-500">{pages.length} pages indexed</p>
        <div className="mt-4 flex gap-4 text-xs font-sans">
          <Link
            href="/about"
            className="text-stone-500 hover:text-stone-800 underline decoration-stone-300 hover:decoration-stone-600 transition-all duration-[120ms] ease-out"
          >
            About
          </Link>
          <Link
            href="/about/data"
            className="text-stone-500 hover:text-stone-800 underline decoration-stone-300 hover:decoration-stone-600 transition-all duration-[120ms] ease-out"
          >
            Data & Exports
          </Link>
        </div>
      </div>
      <ol className="py-2">
        {pages.map((p) => {
          const active = p.page_number === currentPage;
          return (
            <li key={p.page_number}>
              <Link
                href={`/read/${documentTitle}/${p.page_number}`}
                className={[
                  "flex items-baseline justify-between px-5 py-2 text-sm",
                  // 120ms ease-out hover, per the motion spec.
                  "transition-colors duration-[120ms] ease-out",
                  active
                    ? "bg-stone-200 text-stone-900 font-medium"
                    : "text-stone-700 hover:bg-stone-100",
                ].join(" ")}
              >
                <span>Page {p.page_number}</span>
                {!p.has_blocks && (
                  <span className="text-[10px] uppercase tracking-wider text-stone-400">
                    not indexed
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
