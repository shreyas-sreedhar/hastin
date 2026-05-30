-- Tie blocks to their source page so re-running block detection (or
-- re-OCR'ing a page) doesn't leave orphaned blocks. ON DELETE CASCADE
-- means dropping a page drops its blocks.

ALTER TABLE blocks ADD COLUMN page_id UUID REFERENCES pages(id) ON DELETE CASCADE;

CREATE INDEX blocks_page_id_idx ON blocks(page_id);
CREATE INDEX blocks_document_order_global_idx ON blocks(document_id, block_order);
