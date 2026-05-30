"""Translate blocks via Claude and write translation/translation_model/translated_at.

Default behavior: process every block in the document where translation
IS NULL, in block_order. --force re-translates everything (Rule 2:
derived data is replaceable). --pages CSV restricts to specific pages.

The first call writes the system-prompt cache; every call after reads
from it. We process sequentially on purpose — firing N parallel
requests on a cold cache costs N writes instead of 1 write + (N-1)
reads. Concurrency could be added later by sending one warm-up call
first, then fanning out.

Per-block usage is logged so you can spot a cold cache (cache_read=0
after the first call) or a runaway cost.
"""

import argparse
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

from _lib._lib_root import REPO_ROOT
from _lib.db import connect
from _lib.log import get_logger
from _lib.translation import TranslationService

load_dotenv(REPO_ROOT / ".env")

log = get_logger("translate")

DEFAULT_TITLE = "Hastyayurveda"


def get_document_id(cur, title: str) -> str:
    cur.execute("SELECT id FROM documents WHERE title = %s", (title,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"no document with title={title!r}")
    return str(row[0])


def fetch_target_blocks(cur, document_id: str, only: list[int] | None, force: bool, limit: int | None) -> list[tuple]:
    sql = "SELECT id, block_type, block_content, iast_text FROM blocks WHERE document_id = %s"
    params: list = [document_id]
    if not force:
        sql += " AND translation IS NULL"
    if only is not None:
        sql += " AND page_number = ANY(%s)"
        params.append(only)
    sql += " ORDER BY block_order"
    if limit is not None:
        sql += " LIMIT %s"
        params.append(limit)
    cur.execute(sql, tuple(params))
    return cur.fetchall()


def update_translation(cur, block_id: str, translation: str, model: str) -> None:
    cur.execute(
        """
        UPDATE blocks
           SET translation = %s,
               translation_model = %s,
               translated_at = now()
         WHERE id = %s
        """,
        (translation, model, block_id),
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", default=DEFAULT_TITLE)
    ap.add_argument("--pages", default=None,
                    help="comma-separated 1-based page numbers to scope to")
    ap.add_argument("--limit", type=int, default=None, help="cap rows this run")
    ap.add_argument("--force", action="store_true",
                    help="re-translate even rows that already have translation")
    ap.add_argument("--model", default=None,
                    help="override model (e.g. claude-sonnet-4-6 for a cheaper run)")
    ap.add_argument("--effort", default=None, choices=["low", "medium", "high", "max"],
                    help="adaptive-thinking effort (default: medium)")
    ap.add_argument("--dry-run", action="store_true",
                    help="print what would be processed but don't call the API or write")
    args = ap.parse_args()

    only = [int(s) for s in args.pages.split(",") if s.strip()] if args.pages else None

    if not args.dry_run and not os.environ.get("ANTHROPIC_API_KEY"):
        log.error("ANTHROPIC_API_KEY is not set")
        return 1

    svc_kwargs: dict = {}
    if args.model:
        svc_kwargs["model"] = args.model
    if args.effort:
        svc_kwargs["effort"] = args.effort
    service = TranslationService(**svc_kwargs) if not args.dry_run else None

    totals = {"processed": 0, "input_tokens": 0, "output_tokens": 0,
              "cache_read": 0, "cache_write": 0, "elapsed_s": 0.0}

    with connect() as conn:
        with conn.cursor() as cur:
            document_id = get_document_id(cur, args.title)
            rows = fetch_target_blocks(cur, document_id, only, args.force, args.limit)
            log.info("document_id=%s candidates=%d force=%s model=%s",
                     document_id, len(rows), args.force, args.model or "default")

            if args.dry_run:
                for block_id, block_type, content, iast in rows:
                    log.info("would translate id=%s type=%s len=%d", block_id, block_type, len(content or ""))
                return 0

            for i, (block_id, block_type, content, iast) in enumerate(rows, 1):
                t0 = time.monotonic()
                result = service.translate(block_type, content or "", iast)
                elapsed = time.monotonic() - t0

                totals["processed"] += 1
                totals["input_tokens"] += result.input_tokens
                totals["output_tokens"] += result.output_tokens
                totals["cache_read"] += result.cache_read_input_tokens
                totals["cache_write"] += result.cache_creation_input_tokens
                totals["elapsed_s"] += elapsed

                log.info(
                    "[%d/%d] type=%s elapsed=%.1fs in=%d out=%d cache_read=%d cache_write=%d",
                    i, len(rows), block_type, elapsed,
                    result.input_tokens, result.output_tokens,
                    result.cache_read_input_tokens, result.cache_creation_input_tokens,
                )

                if result.translation:
                    update_translation(cur, str(block_id), result.translation, result.model)
                    conn.commit()  # commit per row so a crash mid-batch doesn't lose work
                else:
                    log.warning("empty translation for block id=%s", block_id)

    log.info(
        "done. processed=%d in=%d out=%d cache_read=%d cache_write=%d elapsed=%.1fs",
        totals["processed"], totals["input_tokens"], totals["output_tokens"],
        totals["cache_read"], totals["cache_write"], totals["elapsed_s"],
    )
    if totals["processed"] >= 2 and totals["cache_read"] == 0:
        log.warning("cache_read totaled 0 across multiple calls — system prompt isn't being cached. "
                    "Check for silent invalidators (per-request timestamps, tool churn, model swap).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
