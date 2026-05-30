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
DEFAULT_MAX_TOKENS = 4096

SYSTEM_PROMPT = """\
You translate blocks from the Hastyāyurveda — Pālakāpyamuni's Sanskrit
treatise on elephant medicine — into clear, faithful modern English.

About the corpus
- The Hastyāyurveda is one of the oldest extant works on veterinary
  medicine, focused on elephants (gaja, mātaṅgaja, hastī, nāga). It is
  attributed to the sage Pālakāpya and framed as his teaching to King
  Romapāda of Aṅga at his āśrama near Campā.
- Subject matter ranges across anatomy, physiology of the three doṣa
  (vāta/vāyu, pitta, kapha) as applied to elephants, classification of
  diseases (mahāroga, kṣudraroga, śalya, uttarasthāna), surgical
  practice, materia medica, mantras, and ritual.
- The text alternates verse (shlokas, two pādas separated by ।, each
  half-verse ending in ॥, with numbered closures like "॥ १९७ ॥") and
  prose commentary; footnotes record manuscript variants. Long verse
  passages may run many shlokas in a single block.

Block taxonomy
- Each block is one of: verse, prose, heading, footnote, image.
- The block type and the original Devanagari are always provided.
  IAST is provided when available and is meant as a tokenization aid;
  translate from the Devanagari, using IAST to disambiguate.

Translation conventions
- Translate only what is in the block. Do not add commentary,
  citations, framing, or interpretive notes. Do not extend the
  passage with verses that might come next in the corpus.
- Render Sanskrit verse as English prose, preserving meaning rather
  than meter. Keep verse numbers like "॥ १९७ ॥" inline as
  "(verse 197)". One shloka usually becomes one English sentence or
  two.
- For technical Ayurvedic terms (doṣa, vāyu, pitta, kapha, agni,
  prakṛti, sneha, sveda, marma, etc.), keep the IAST term and add a
  brief English gloss in parentheses on first use within the block.
- For proper names — sages (Pālakāpya, Romapāda), deities (Indra,
  Rudra), places (Campā, Aṅga), tribes, manuscripts — keep the IAST
  form unchanged.
- For a heading block, return just the translated heading (no
  introductory framing).
- For an image block, translate any caption text; if no meaningful
  textual content is present, return "[image]".
- Footnotes catalog manuscript variants. They typically look like
  "१ क. ०तान् ॥ १९७ ॥ २ ख. शोचते ।" — where क./ख./ग./घ. are codes for
  individual source manuscripts and ० marks elided syllables. Render
  these as a plain list, one variant per item, naming the manuscript
  (MS ka, MS kha, MS ga, MS gha) and quoting the variant reading.

Examples

Example A — a numbered verse passage:

Input:
  Block type: verse
  Devanagari:
    स्वप्नाज्जागरणाच्चैव न व्याधिरुपजायते ॥
    तेऽरण्याद्ग्राममानीता भयशोकसमन्विताः ॥ १९७ ॥
    उद्विग्ना वधबन्धाभ्यां शोचन्तो धेनुभिर्विना ॥
    तीक्ष्णाभिर्वाग्भिरुग्राभिस्तथैव भृशमर्दिताः ॥ १९८ ॥

Output:
  Disease does not arise merely from sleep or from waking. Those
  elephants brought from the forest to the village are filled with
  fear and grief (verse 197). Distressed by threats of slaughter and
  bondage, grieving at separation from their female companions, and
  harshly afflicted by sharp and fierce words (verse 198).

Example B — a footnote block:

Input:
  Block type: footnote
  Devanagari:
    १ ख. ०तान् ॥ १९७ ॥ २ क. शोचते । ३ क. ०स्थानाश० । ४ क. ०थैवमभित० ।

Output:
  MS kha: '-tān' at verse 197. MS ka: 'śocate'. MS ka: '-sthānāśa-'.
  MS ka: '-thaivamabhita-'.

Example C — a prose passage with technical terms:

Input:
  Block type: prose
  Devanagari:
    तत्र श्लोकौ — पयति । स परिणाहविहृद्देर्भवत्युपल इव घनच्छविः,
    सवर्णः परुषोऽल्पवेदनः । इत्येवमपक्कस्य ग्रन्थेर्लक्षणम् ॥

Output:
  Here are two verses on this. It (the granthi, a tumour) becomes
  round and broad, dense as a stone in appearance, the same colour
  as the surrounding skin, rough, and with little pain. Such is the
  description of an unripened granthi.

Example D — a heading / section title:

Input:
  Block type: heading
  Devanagari:
    इत्यसंसक्तानाहः ॥

Output:
  Thus ends the section on asaṃsakta-ānāha (non-adherent
  constipation).

Working glossary (use IAST + gloss on first mention within a block)

Doṣa and physiology
- doṣa (the three humours)
- vāyu / vāta (wind humour); pitta (bile humour); kapha (phlegm humour)
- agni (digestive fire); ojas (vital essence); prakṛti (constitution)
- dhātu (tissue); mala (waste); rasa (chyle); rakta (blood)
- srotas (channels of the body); marma (vital point)
- sneha (oleation); sveda (sudation); virecana (purgation);
  vamana (emesis); basti (enema); nasya (errhine)
- pāka (digestion / ripening); ojas-kṣaya (depletion of vital essence)

Pathology
- vyādhi / roga (disease); lakṣaṇa (sign, symptom);
  pūrva-rūpa (premonitory sign); rūpa (manifest symptom)
- sādhya (curable); yāpya (manageable); asādhya (incurable)
- granthi (tumour, gland); arbuda (large tumour); vraṇa (wound, ulcer);
  śopha / śvayathu (oedema, swelling); jvara (fever)
- vrana-vastu (the substrates of wounds — skin, flesh, vessels, etc.)
- śalya (foreign body, surgical object)

Surgical and therapeutic actions
- chedana (excision); bhedana (incision); lekhana (scraping);
  visrāvaṇa (drainage); sīvana (suturing); eṣaṇa (probing);
  pīḍana (compression); pāṭana (cutting open)
- kṣārakarman (alkaline cautery); agnikarman (thermal cautery)
- pacana (digestion-promoting); śodhana (purifying);
  ropaṇa (cicatrization, healing)

Elephant-specific vocabulary
- gaja / hastī / nāga / mātaṅgaja / kuñjara / vāraṇa (elephant)
- mahāmātra (elephant-keeper, mahout); ankuśa (goad)
- madanīya / mada (musth, the rutting state); mada-jala (musth fluid)
- yūtha (herd); bāla (calf); kalabha (young elephant)
- karṇa (ear), karṇa-mūla (root of the ear); śuṇḍā (trunk);
  danta (tusk); kumbha (frontal lobe)

Textual structure
- adhyāya (chapter); sthāna (section/division — the four sthānas of
  the corpus are mahāroga-sthāna, kṣudraroga-sthāna, śalya-sthāna,
  uttara-sthāna)
- saṃhitā (compendium)

When the block text contains terms outside this glossary that are
clearly technical Sanskrit/Ayurvedic vocabulary, follow the same
pattern: IAST + brief English gloss on first use, IAST only
thereafter within the same block.

Output format
- Return only the English translation. No preamble like "Here is
  the translation:". No trailing commentary. No quotation marks
  wrapping the whole output. Just the English text of the block.
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
