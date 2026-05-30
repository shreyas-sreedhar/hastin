"""TranslationService — Devanagari / IAST block -> English via Claude.

Design notes
------------
* Default model is claude-opus-4-7 (per Anthropic Python SDK guidance for
  intelligence-sensitive tasks). Sanskrit translation of a technical
  Ayurvedic corpus is exactly that. Sonnet 4.6 is a cheaper fallback the
  caller can pass in if they want to trade quality for cost.
* The corpus context + translation conventions live in the system prompt
  with cache_control: ephemeral. For a continuous batch run, the cache
  stays warm for the whole job — pay the 1.25x write once, then 0.1x
  reads for every block after. Verify with usage.cache_read_input_tokens
  after the first few calls; if it stays at zero, a silent invalidator
  snuck into the prefix.
* Adaptive thinking is enabled with effort=medium. Sanskrit verse needs
  some reasoning; max effort overspends.
* The SDK auto-retries 429/5xx; we bump max_retries to 5 because batch
  runs are long and we'd rather sleep than fail.
"""

from dataclasses import dataclass

import anthropic

DEFAULT_MODEL = "claude-opus-4-7"
DEFAULT_EFFORT = "medium"
DEFAULT_MAX_TOKENS = 2048

SYSTEM_PROMPT = """\
You translate blocks from the Hastyāyurveda — Pālakāpyamuni's Sanskrit
treatise on elephant medicine — into clear, faithful modern English.

About the corpus
- The text alternates verse (shlokas, marked by ॥) with prose
  commentary; the prose discusses anatomy, doṣa theory, diseases of
  elephants, surgical procedures, mantras, and ritual.
- Block content has been segmented for you. Each block is one of:
  verse, prose, heading, footnote, image (rare).
- Footnotes catalog manuscript variants. They typically look like
  "१ क. ०तान् ॥ १९७ ॥ २ ख. शोचते ।" where क./ख./ग. are codes for the
  source manuscripts. Render these as a plain list of variants in
  English, e.g. "MS क: 'tān' (verse 197). MS ख: 'śocate.'"

Translation conventions
- Translate only what is in the block. Do not add commentary,
  citations, framing, or interpretive notes.
- Render Sanskrit verse as English prose, preserving meaning rather
  than meter. Keep verse numbers like "॥ १९७ ॥" inline as
  "(verse 197)".
- For technical Ayurvedic terms (doṣa, vāyu, pitta, kapha, agni,
  prakṛti, etc.), keep the IAST term and add a brief English gloss
  in parentheses on first use within the block.
- For names of authorities, deities, or places, keep the IAST form.
- For a heading block, return just the translated heading.
- For an image block, translate any caption text; if there's no
  meaningful textual content, return "[image]".

Output
- Return only the English translation. No preamble like "Here is the
  translation:". No trailing commentary. Just the English.
"""


@dataclass(frozen=True)
class TranslationResult:
    translation: str
    model: str
    # Token accounting from the response — caller can log / aggregate.
    input_tokens: int
    output_tokens: int
    cache_read_input_tokens: int
    cache_creation_input_tokens: int


def _build_user_content(block_type: str, devanagari: str, iast: str | None) -> str:
    parts = [
        f"<block type=\"{block_type}\">",
        "<devanagari>",
        devanagari.strip(),
        "</devanagari>",
    ]
    if iast:
        parts.extend([
            "<iast>",
            iast.strip(),
            "</iast>",
        ])
    parts.append("</block>")
    parts.append("")
    parts.append("Translate the block above into English following the conventions in the system prompt.")
    return "\n".join(parts)


class TranslationService:
    def __init__(
        self,
        client: anthropic.Anthropic | None = None,
        model: str = DEFAULT_MODEL,
        effort: str = DEFAULT_EFFORT,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ):
        self.client = client or anthropic.Anthropic(max_retries=5, timeout=60.0)
        self.model = model
        self.effort = effort
        self.max_tokens = max_tokens

    def translate(
        self,
        block_type: str,
        devanagari: str,
        iast: str | None,
    ) -> TranslationResult:
        if not devanagari.strip():
            return TranslationResult(
                translation="",
                model=self.model,
                input_tokens=0,
                output_tokens=0,
                cache_read_input_tokens=0,
                cache_creation_input_tokens=0,
            )

        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            thinking={"type": "adaptive"},
            output_config={"effort": self.effort},
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": _build_user_content(block_type, devanagari, iast),
                }
            ],
        )

        # Concatenate text blocks (skip thinking blocks).
        text_parts: list[str] = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
        translation = "".join(text_parts).strip()

        usage = response.usage
        return TranslationResult(
            translation=translation,
            model=self.model,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cache_read_input_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
            cache_creation_input_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
        )


if __name__ == "__main__":
    # Smoke test — exercise one verse + one footnote so we see what the
    # cache write / cache read pattern looks like across two calls.
    # Requires ANTHROPIC_API_KEY in the environment.
    import os
    import sys
    from pathlib import Path
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set — skipping live smoke", file=sys.stderr)
        sys.exit(0)

    svc = TranslationService()

    print("--- call 1: verse (cache write) ---")
    r1 = svc.translate(
        "verse",
        "स्वप्नाज्जागरणाच्चैव न व्याधिरुपजायते ॥\nतेऽरण्याद्ग्राममानीता भयशोकसमन्विताः ॥ १९७ ॥",
        "svapnājjāgaraṇāccaiva na vyādhirupajāyate ||\nte'raṇyādgrāmamānītā bhayaśokasamanvitāḥ || 197 ||",
    )
    print(f"in={r1.input_tokens} out={r1.output_tokens} "
          f"cache_read={r1.cache_read_input_tokens} cache_write={r1.cache_creation_input_tokens}")
    print(r1.translation)

    print("\n--- call 2: prose (cache read should be > 0) ---")
    r2 = svc.translate(
        "prose",
        "हस्तपाद्यवत् ।",
        "hastapādyavat |",
    )
    print(f"in={r2.input_tokens} out={r2.output_tokens} "
          f"cache_read={r2.cache_read_input_tokens} cache_write={r2.cache_creation_input_tokens}")
    print(r2.translation)

    if r2.cache_read_input_tokens == 0:
        print("\nWARNING: cache_read_input_tokens=0 on the second call — "
              "the cache prefix isn't being reused. Check the silent-invalidator list.")
    else:
        print(f"\ncache working: {r2.cache_read_input_tokens} tokens served from cache on call 2.")
