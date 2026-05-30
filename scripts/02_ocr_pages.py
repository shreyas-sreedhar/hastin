"""Run Sarvam OCR over pages that don't have a successful ocr_pages row.

Batches pages (default 10, the Sarvam limit), retries on transient
failure, and stores the provider markdown verbatim. Failed pages are
recorded with the error so they can be retried later. Never mutates a
row that already succeeded.
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
import traceback
import zipfile
from pathlib import Path

from dotenv import load_dotenv
from sarvamai import SarvamAI

from _lib._lib_root import REPO_ROOT
from _lib.db import connect
from _lib.log import get_logger
from _lib.storage import read_bytes

load_dotenv(REPO_ROOT / ".env")

log = get_logger("ocr")

DEFAULT_TITLE = "Hastyayurveda"
DEFAULT_BATCH_SIZE = 10
DEFAULT_MAX_RETRIES = 3
DEFAULT_LANGUAGE = "sa-IN"
PROVIDER = "sarvam"


def pending_pages(cur, document_id: str, limit: int | None) -> list[tuple]:
    sql = """
        SELECT p.id, p.page_number, p.storage_backend, p.storage_key
        FROM pages p
        LEFT JOIN ocr_pages o ON o.page_id = p.id
        WHERE p.document_id = %s
          AND (o.id IS NULL OR o.status = 'failed')
        ORDER BY p.page_number
    """
    params: tuple = (document_id,)
    if limit is not None:
        sql += " LIMIT %s"
        params = (document_id, limit)
    cur.execute(sql, params)
    return cur.fetchall()


def get_document_id(cur, title: str) -> str:
    cur.execute("SELECT id FROM documents WHERE title = %s", (title,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"no document with title={title!r}; run 01_extract_pages.py first")
    return str(row[0])


def upsert_ocr_row(cur, page_id: str, status: str, raw_response: dict | None,
                   metrics: dict | None, error: str | None, attempts: int) -> None:
    cur.execute(
        """
        INSERT INTO ocr_pages
            (page_id, provider, status, raw_response, metrics, error, attempts)
        VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
        ON CONFLICT (page_id) DO UPDATE SET
            status = EXCLUDED.status,
            raw_response = EXCLUDED.raw_response,
            metrics = EXCLUDED.metrics,
            error = EXCLUDED.error,
            attempts = ocr_pages.attempts + EXCLUDED.attempts,
            updated_at = now()
        WHERE ocr_pages.status = 'failed'
        """,
        (page_id, PROVIDER, status,
         json.dumps(raw_response) if raw_response is not None else None,
         json.dumps(metrics) if metrics is not None else None,
         error, attempts),
    )


def stage_batch(batch: list[tuple], tmp_dir: Path) -> tuple[Path, dict[int, int]]:
    """Copy batch images into tmp_dir with 1-based batch-local names.

    Returns (zip_path, {batch_local_idx: real_page_number}). Sarvam's
    per-page metadata is named after the batch-local index (page_001.json
    for the first input), so we map back via this dict.
    """
    page_index_map: dict[int, int] = {}
    for i, (_, page_number, backend, key) in enumerate(batch, 1):
        data = read_bytes(backend, key)
        (tmp_dir / f"page_{i:04d}.png").write_bytes(data)
        page_index_map[i] = page_number
    zip_path = tmp_dir / "batch.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for png in sorted(tmp_dir.glob("page_*.png")):
            zf.write(png, png.name)
    return zip_path, page_index_map


def submit_once(client: SarvamAI, zip_path: Path, out_dir: Path,
                language: str, page_index_map: dict[int, int]
               ) -> tuple[dict[int, dict], dict]:
    """Submit one batch zip. Returns ({page_number: raw_response_json}, metrics).

    page_index_map maps the batch-local 1-based index (matching Sarvam's
    page_NNN.json) to the real page_number for the document.
    """
    job = client.document_intelligence.create_job(language=language, output_format="md")
    job.upload_file(str(zip_path))
    job.start()
    status = job.wait_until_complete()
    if getattr(status, "job_state", None) and status.job_state.lower() not in ("completed", "complete", "success"):
        raise RuntimeError(f"job state: {status.job_state}")

    out_zip = out_dir / "out.zip"
    job.download_output(str(out_zip))

    extracted = out_dir / "extracted"
    extracted.mkdir(exist_ok=True)
    with zipfile.ZipFile(out_zip, "r") as zf:
        zf.extractall(extracted)

    results: dict[int, dict] = {}
    for jf in extracted.rglob("page_*.json"):
        try:
            batch_idx = int(jf.stem.split("_")[-1])
        except ValueError:
            continue
        page_number = page_index_map.get(batch_idx)
        if page_number is None:
            continue
        results[page_number] = json.loads(jf.read_text(encoding="utf-8"))

    try:
        metrics = job.get_page_metrics()
    except Exception:
        metrics = {}
    return results, metrics


def process_batch(client: SarvamAI, batch: list[tuple], language: str, max_retries: int) -> None:
    """Run one batch with retries. Writes ocr_pages rows for every page in the batch."""
    page_numbers = [b[1] for b in batch]
    log.info("batch start: pages=%s", page_numbers)

    last_err: str | None = None
    results: dict[int, dict] = {}
    metrics: dict = {}
    attempts_used = 0

    for attempt in range(1, max_retries + 1):
        attempts_used = attempt
        tmp = Path(tempfile.mkdtemp(prefix="ocr_"))
        try:
            zip_path, page_index_map = stage_batch(batch, tmp)
            results, metrics = submit_once(client, zip_path, tmp, language, page_index_map)
            last_err = None
            break
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            log.warning("batch attempt %d failed: %s", attempt, last_err)
            log.debug(traceback.format_exc())
            if attempt < max_retries:
                backoff = 2 ** attempt
                log.info("sleeping %ds before retry", backoff)
                time.sleep(backoff)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    with connect() as conn:
        with conn.cursor() as cur:
            for page_id, page_number, _, _ in batch:
                payload = results.get(page_number)
                if payload is not None:
                    upsert_ocr_row(cur, page_id, "success", payload, metrics or None, None, attempts_used)
                else:
                    err = last_err or "no metadata returned for page"
                    upsert_ocr_row(cur, page_id, "failed", None, metrics or None, err, attempts_used)
                    log.error("page %d failed: %s", page_number, err)

    log.info("batch done: success=%d failed=%d",
             sum(1 for _, n, _, _ in batch if n in results),
             sum(1 for _, n, _, _ in batch if n not in results))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", default=DEFAULT_TITLE)
    ap.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    ap.add_argument("--max-retries", type=int, default=DEFAULT_MAX_RETRIES)
    ap.add_argument("--language", default=DEFAULT_LANGUAGE)
    ap.add_argument("--limit", type=int, default=None, help="cap total pages this run")
    ap.add_argument("--sleep-between-batches", type=float, default=5.0)
    args = ap.parse_args()

    api_key = os.environ.get("SARVAM_API_KEY")
    if not api_key:
        log.error("SARVAM_API_KEY is not set")
        return 1
    client = SarvamAI(api_subscription_key=api_key)

    with connect() as conn:
        with conn.cursor() as cur:
            document_id = get_document_id(cur, args.title)
            pending = pending_pages(cur, document_id, args.limit)
    log.info("document_id=%s pending=%d", document_id, len(pending))

    if not pending:
        log.info("nothing to do")
        return 0

    batches = [pending[i:i + args.batch_size] for i in range(0, len(pending), args.batch_size)]
    log.info("batches=%d size<=%d", len(batches), args.batch_size)

    for i, batch in enumerate(batches, 1):
        log.info("---- batch %d/%d ----", i, len(batches))
        process_batch(client, batch, args.language, args.max_retries)
        if i < len(batches) and args.sleep_between_batches > 0:
            time.sleep(args.sleep_between_batches)

    return 0


if __name__ == "__main__":
    sys.exit(main())
