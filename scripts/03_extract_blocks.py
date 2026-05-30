"""Run BlockDetector over every page with a successful OCR and persist blocks.

Idempotent per page: delete blocks for the page, insert detected ones.
The blocks.page_id FK lets us scope the delete tightly so re-runs only
touch the page being processed.
"""

import argparse
import sys

from _lib.block_detector import BlockDetector
from _lib.db import connect
from _lib.log import get_logger

log = get_logger("blocks")

DEFAULT_TITLE = "Hastyayurveda"


def get_document_id(cur, title: str) -> str:
    cur.execute("SELECT id FROM documents WHERE title = %s", (title,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"no document with title={title!r}")
    return str(row[0])


def pages_with_ocr(cur, document_id: str, only: list[int] | None) -> list[tuple]:
    sql = """
        SELECT p.id, p.page_number, o.raw_response
        FROM pages p
        JOIN ocr_pages o ON o.page_id = p.id
        WHERE p.document_id = %s AND o.status = 'success'
    """
    params: list = [document_id]
    if only is not None:
        sql += " AND p.page_number = ANY(%s)"
        params.append(only)
    sql += " ORDER BY p.page_number"
    cur.execute(sql, tuple(params))
    return cur.fetchall()


def replace_blocks_for_page(cur, document_id: str, page_id: str, detected: list) -> int:
    cur.execute("DELETE FROM blocks WHERE page_id = %s", (page_id,))
    if not detected:
        return 0
    rows = [
        (document_id, page_id, b.block_type, b.block_order, b.block_content, b.page_number)
        for b in detected
    ]
    cur.executemany(
        "INSERT INTO blocks "
        "(document_id, page_id, block_type, block_order, block_content, page_number) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        rows,
    )
    return len(rows)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", default=DEFAULT_TITLE)
    ap.add_argument("--pages", default=None,
                    help="comma-separated 1-based page numbers (else: all)")
    args = ap.parse_args()
    only = [int(s) for s in args.pages.split(",") if s.strip()] if args.pages else None

    detector = BlockDetector()
    totals = {"pages": 0, "blocks": 0}
    by_type: dict[str, int] = {}

    with connect() as conn:
        with conn.cursor() as cur:
            document_id = get_document_id(cur, args.title)
            rows = pages_with_ocr(cur, document_id, only)
            log.info("document_id=%s ocr_pages=%d", document_id, len(rows))

            for page_id, page_number, raw in rows:
                detected = list(detector.detect(page_number, raw))
                n = replace_blocks_for_page(cur, document_id, str(page_id), detected)
                totals["pages"] += 1
                totals["blocks"] += n
                for b in detected:
                    by_type[b.block_type] = by_type.get(b.block_type, 0) + 1
                log.info("page=%d blocks=%d", page_number, n)

    log.info("done. pages=%d blocks=%d by_type=%s",
             totals["pages"], totals["blocks"], by_type)
    return 0


if __name__ == "__main__":
    sys.exit(main())
