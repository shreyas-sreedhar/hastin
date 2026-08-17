# Hastin

The *Hastyāyurveda* is a Sanskrit treatise on elephant medicine. Like most historical scientific manuscripts it exists as page scans, which means the contents are invisible to search. Hastin is a pipeline that renders those pages, OCRs them, detects blocks, transliterates, and translates — then a reader on top so you can search and question the corpus with the scan still in view.

Built in about 36 hours. The ideas are further along than the seams.

## What it does

- Five-stage ingest: PDF pages → OCR (Sarvam) → block detection → IAST transliteration → Claude translation
- Everything lands in Postgres
- A Next.js reader with search across Devanagari, romanised, and English (`pg_trgm` / `ILIKE`, not stock FTS — FTS does not tokenise this script mix usefully)
- An assistant that has to cite a block UUID or say it cannot answer

## Layout

```
scripts/           ingest pipeline (01–05) and shared Python libs
packages/db/       Postgres migrations
apps/web/          Next.js reader + search + chat
```

## Setup

You need Postgres, [pnpm](https://pnpm.io), and Python 3 with `psycopg`, `python-dotenv`, PyMuPDF (`fitz`), `sarvamai`, and the Anthropic SDK. Put secrets in a root `.env` (gitignored):

| Variable | Used by |
| --- | --- |
| `DATABASE_URL` | pipeline, migrations, web app |
| `SARVAM_API_KEY` | `scripts/02_ocr_pages.py` |
| `ANTHROPIC_API_KEY` | `scripts/05_translate_blocks.py`, chat API |

Migrate, then run the pipeline in order (each step is idempotent):

```bash
cd packages/db && pnpm migrate
cd ../../scripts
python 01_extract_pages.py
python 02_ocr_pages.py
python 03_extract_blocks.py
python 04_transliterate_blocks.py
python 05_translate_blocks.py
```

Reader:

```bash
cd apps/web
pnpm install
pnpm dev
```

The default document title the scripts look for is `Hastyayurveda`. The source PDF is gitignored.

## Limits

The PDF download route still has a laptop path hardcoded in it, and the corpus export assumes a single document. Neither is hard to fix — they are the parts nobody needed working at the time.
