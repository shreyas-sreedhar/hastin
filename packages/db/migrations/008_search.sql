-- Lexical search across Devanagari (block_content), IAST (iast_text),
-- and English (translation). Postgres FTS doesn't tokenize Devanagari
-- usefully and our IAST has diacritics FTS treats as word separators,
-- so pg_trgm + ILIKE is the right primitive. Trigram indexes give
-- sub-linear lookup for substring queries across all three scripts
-- with the same operator.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX blocks_content_trgm_idx ON blocks USING gin (block_content gin_trgm_ops);
CREATE INDEX blocks_iast_trgm_idx    ON blocks USING gin (iast_text     gin_trgm_ops);
CREATE INDEX blocks_translation_trgm_idx ON blocks USING gin (translation gin_trgm_ops);
