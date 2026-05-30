"""Render PDF pages to PNG, persist to storage, and record page rows.

Idempotent: re-running skips pages already present for the document.
"""

import argparse
import sys
from pathlib import Path

import fitz  # PyMuPDF

from _lib.db import connect
from _lib.log import get_logger
from _lib.storage import write_bytes

log = get_logger("extract")

DEFAULT_PDF = Path(__file__).resolve().parents[1] / "hastyayurveda.pdf"
DEFAULT_TITLE = "Hastyayurveda"
ZOOM = 2.0  # ~144 DPI


def upsert_document(cur, title: str, source_pdf: str) -> str:
    cur.execute("SELECT id FROM documents WHERE title = %s", (title,))
    row = cur.fetchone()
    if row:
        return str(row[0])
    cur.execute(
        "INSERT INTO documents (title, source_pdf) VALUES (%s, %s) RETURNING id",
        (title, source_pdf),
    )
    return str(cur.fetchone()[0])


def existing_page_numbers(cur, document_id: str) -> set[int]:
    cur.execute(
        "SELECT page_number FROM pages WHERE document_id = %s", (document_id,)
    )
    return {r[0] for r in cur.fetchall()}


def render_page(page) -> tuple[bytes, int, int]:
    mat = fitz.Matrix(ZOOM, ZOOM)
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
    return pix.tobytes("png"), pix.width, pix.height


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    ap.add_argument("--title", default=DEFAULT_TITLE)
    ap.add_argument("--limit", type=int, default=None, help="cap pages (for testing)")
    ap.add_argument("--pages", default=None,
                    help="comma-separated 1-based page numbers (overrides --limit)")
    args = ap.parse_args()

    if not args.pdf.exists():
        log.error("PDF not found: %s", args.pdf)
        return 1

    log.info("opening %s", args.pdf)
    doc = fitz.open(args.pdf)
    total = len(doc)
    log.info("pages in pdf: %d", total)

    with connect() as conn:
        with conn.cursor() as cur:
            document_id = upsert_document(cur, args.title, str(args.pdf.name))
            done = existing_page_numbers(cur, document_id)
            log.info("document_id=%s already-extracted=%d", document_id, len(done))

            if args.pages:
                targets = [int(s) for s in args.pages.split(",") if s.strip()]
            else:
                target_count = args.limit if args.limit is not None else total
                targets = list(range(1, target_count + 1))

            new_count = 0

            for page_number in targets:
                if page_number < 1 or page_number > total:
                    log.warning("skipping out-of-range page %d", page_number)
                    continue
                if page_number in done:
                    continue
                png, w, h = render_page(doc[page_number - 1])
                key = f"pages/{document_id}/{page_number:04d}.png"
                backend, stored_key = write_bytes(key, png)
                cur.execute(
                    """
                    INSERT INTO pages
                        (document_id, page_number, storage_backend, storage_key, width, height)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (document_id, page_number, backend, stored_key, w, h),
                )
                new_count += 1
                if new_count % 25 == 0:
                    log.info("rendered %d pages", new_count)

            log.info("done. new_pages=%d total_target=%d", new_count, len(targets))

    return 0


if __name__ == "__main__":
    sys.exit(main())
