"""BlockDetector — turn a Sarvam OCR page payload into Hastin blocks.

Input is the dict stored at ocr_pages.raw_response: { page_num, blocks: [...] }.
Each Sarvam block has a layout_tag and free-form text. We map those to
the five Hastin block types (verse, prose, heading, footnote, image)
and skip running page chrome (page headers, page numbers).

Verse vs prose for paragraph blocks is decided by the presence of
'॥' (double danda) anywhere in the text — the standard Sanskrit
verse-end / half-verse marker. This is intentionally conservative:
prose can contain '।' (single danda) but rarely '॥'.
"""

from dataclasses import dataclass
from typing import Iterable, Iterator

# valid block types per the 001_init.sql CHECK constraint
VALID_BLOCK_TYPES = {"verse", "prose", "heading", "footnote", "image"}

# Sarvam layout_tags we explicitly drop (running page chrome, not content)
SKIP_TAGS = {"header", "page-number"}

# Double danda — Sanskrit verse delimiter
VERSE_MARKER = "॥"  # ॥


@dataclass(frozen=True)
class DetectedBlock:
    block_type: str
    block_order: int  # global, document-wide
    block_content: str
    page_number: int
    source_block_id: str  # provider id, for debugging


def _classify_paragraph(text: str) -> str:
    return "verse" if VERSE_MARKER in text else "prose"


def _map_tag(layout_tag: str, text: str) -> str | None:
    """Return a Hastin block_type, or None to drop the block."""
    if layout_tag in SKIP_TAGS:
        return None
    if layout_tag == "image":
        return "image"
    if layout_tag == "section-title":
        return "heading"
    if layout_tag in ("footnote", "footer"):
        return "footnote"
    if layout_tag == "paragraph":
        return _classify_paragraph(text)
    # Unknown tag — be permissive: treat as prose, but the caller can log.
    return _classify_paragraph(text)


class BlockDetector:
    """Stateless detector. Construct once, call .detect(...) per page.

    block_order is computed as page_number * ORDER_STRIDE + reading_order,
    which gives a stable, sortable document-wide ordering as long as a
    single page has fewer than ORDER_STRIDE blocks (1000 is more than
    safe for prose manuscripts).
    """

    ORDER_STRIDE = 1000

    def detect(self, raw_response: dict) -> Iterator[DetectedBlock]:
        page_number = int(raw_response.get("page_num") or 0)
        if page_number <= 0:
            return
        blocks: Iterable[dict] = raw_response.get("blocks") or []
        for b in blocks:
            text = (b.get("text") or "").strip()
            if not text:
                continue
            tag = (b.get("layout_tag") or "").strip()
            mapped = _map_tag(tag, text)
            if mapped is None:
                continue
            if mapped not in VALID_BLOCK_TYPES:
                continue
            reading_order = int(b.get("reading_order") or 0)
            yield DetectedBlock(
                block_type=mapped,
                block_order=page_number * self.ORDER_STRIDE + reading_order,
                block_content=text,
                page_number=page_number,
                source_block_id=str(b.get("block_id") or ""),
            )


if __name__ == "__main__":
    # Smoke test — exercise each branch of the classifier without a DB.
    sample = {
        "page_num": 7,
        "blocks": [
            {"layout_tag": "header", "text": "running header noise",
             "reading_order": 1, "block_id": "h"},
            {"layout_tag": "page-number", "text": "७",
             "reading_order": 2, "block_id": "pn"},
            {"layout_tag": "section-title", "text": "इत्यसंसक्तानाहः ॥",
             "reading_order": 3, "block_id": "s"},
            {"layout_tag": "paragraph",
             "text": "स्वप्नाज्जागरणाच्चैव ॥ १९७ ॥",
             "reading_order": 4, "block_id": "v"},
            {"layout_tag": "paragraph",
             "text": "स परिणाहविहृद्देर्भवत्युपल इव घनच्छविः ।",
             "reading_order": 5, "block_id": "p"},
            {"layout_tag": "footnote", "text": "१ क. विषाञ्जनस्य ।",
             "reading_order": 6, "block_id": "fn"},
            {"layout_tag": "footer", "text": "१ क. ततोऽर्थां ।",
             "reading_order": 7, "block_id": "fr"},
            {"layout_tag": "image", "text": "(diagram)",
             "reading_order": 8, "block_id": "i"},
            {"layout_tag": "paragraph", "text": "",
             "reading_order": 9, "block_id": "empty"},
        ],
    }
    detector = BlockDetector()
    out = list(detector.detect(sample))
    expected = ["heading", "verse", "prose", "footnote", "footnote", "image"]
    got = [b.block_type for b in out]
    assert got == expected, f"got {got} expected {expected}"
    # block_order monotonic
    orders = [b.block_order for b in out]
    assert orders == sorted(orders), f"orders not monotonic: {orders}"
    # all on the same page
    assert all(b.page_number == 7 for b in out)
    print("block_detector smoke: ok")
    for b in out:
        print(f"  ord={b.block_order:>6}  type={b.block_type:<8}  text={b.block_content[:50]!r}")
