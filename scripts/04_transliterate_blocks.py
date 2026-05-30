"""Backfill iast_text on blocks using TransliterationService.

By default processes blocks where iast_text IS NULL. --force re-runs
everything (transliteration is derived data per Rule 2). The actual
SQL update is batched via executemany.
"""

import argparse
import sys

from _lib.db import connect
from _lib.log import get_logger
from _lib.transliteration import TransliterationService

log = get_logger("transliterate")

DEFAULT_TITLE = "Hastyayurveda"
BATCH_SIZE = 200


def get_document_id(cur, title: str) -> str:
    cur.execute("SELECT id FROM documents WHERE title = %s", (title,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"no document with title={title!r}")
    return str(row[0])


def fetch_target_blocks(cur, document_id: str, only: list[int] | None, force: bool) -> list[tuple]:
    sql = "SELECT id, block_content, block_type FROM blocks WHERE document_id = %s"
    params: list = [document_id]
    if not force:
        sql += " AND iast_text IS NULL"
    if only is not None:
        sql += " AND page_number = ANY(%s)"
        params.append(only)
    sql += " ORDER BY block_order"
    cur.execute(sql, tuple(params))
    return cur.fetchall()


def update_many(cur, updates: list[tuple[str, str | None]]) -> None:
    """updates is a list of (iast_text, block_id) tuples."""
    cur.executemany(
        "UPDATE blocks SET iast_text = %s WHERE id = %s",
        updates,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", default=DEFAULT_TITLE)
    ap.add_argument("--pages", default=None,
                    help="comma-separated 1-based page numbers to scope to")
    ap.add_argument("--force", action="store_true",
                    help="re-transliterate even rows that already have iast_text")
    ap.add_argument("--dry-run", action="store_true",
                    help="print what would change but don't write")
    args = ap.parse_args()
    only = [int(s) for s in args.pages.split(",") if s.strip()] if args.pages else None

    svc = TransliterationService()
    counts = {"total": 0, "transliterated": 0, "skipped_no_devanagari": 0}

    with connect() as conn:
        with conn.cursor() as cur:
            document_id = get_document_id(cur, args.title)
            blocks = fetch_target_blocks(cur, document_id, only, args.force)
            log.info("document_id=%s candidates=%d force=%s",
                     document_id, len(blocks), args.force)

            pending: list[tuple[str, str]] = []  # (iast, id)
            for block_id, content, block_type in blocks:
                counts["total"] += 1
                iast = svc.to_iast(content or "")
                if iast is None:
                    counts["skipped_no_devanagari"] += 1
                    continue
                counts["transliterated"] += 1
                pending.append((iast, str(block_id)))

                if len(pending) >= BATCH_SIZE and not args.dry_run:
                    update_many(cur, pending)
                    pending.clear()

            if pending and not args.dry_run:
                update_many(cur, pending)

    log.info("done. total=%d transliterated=%d skipped_no_devanagari=%d dry_run=%s",
             counts["total"], counts["transliterated"],
             counts["skipped_no_devanagari"], args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
