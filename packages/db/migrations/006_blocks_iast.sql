-- Derived field per Rule 2: replaceable, regenerable from block_content.
-- Nullable because blocks may not yet have been transliterated, and image
-- blocks without textual content stay NULL.

ALTER TABLE blocks ADD COLUMN iast_text TEXT;
