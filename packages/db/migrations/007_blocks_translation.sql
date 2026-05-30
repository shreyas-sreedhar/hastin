-- Translation output is derived data (Rule 2). Storing the model alongside
-- lets us re-translate only the rows produced by an older/weaker model
-- once a better one ships, instead of nuking the whole column.

ALTER TABLE blocks ADD COLUMN translation TEXT;
ALTER TABLE blocks ADD COLUMN translation_model TEXT;
ALTER TABLE blocks ADD COLUMN translated_at TIMESTAMPTZ;
