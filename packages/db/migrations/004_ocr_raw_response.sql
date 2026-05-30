-- Sarvam returns one merged document.md per batch but per-page JSON
-- (metadata/page_NNN.json). The per-page JSON is the natural "raw OCR
-- exactly as returned" unit for ocr_pages.

ALTER TABLE ocr_pages DROP COLUMN raw_markdown;
ALTER TABLE ocr_pages ADD COLUMN raw_response JSONB;
