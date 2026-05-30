"""TransliterationService — Devanagari -> IAST.

Wraps indic_transliteration's sanscript module. The mapping is
deterministic and well-tested (used by Sanskrit Wikisource, GRETIL,
the SARIT corpus, etc.). The service exists so callers don't need
to know which library is doing the work, and so future swaps
(aksharamukha, custom rules) don't ripple through the codebase.
"""

from indic_transliteration import sanscript

# Anything outside this range can be passed through unchanged.
# U+0900..U+097F is the Devanagari block; U+A8E0..U+A8FF is
# Devanagari Extended (rare). We don't strip — sanscript leaves
# non-Devanagari characters alone, which is what we want for
# mixed-script footnotes and bracketed editorial marks.
_DEVANAGARI_RANGES = (
    (0x0900, 0x097F),
    (0xA8E0, 0xA8FF),
)


def _has_devanagari(text: str) -> bool:
    for ch in text:
        cp = ord(ch)
        for lo, hi in _DEVANAGARI_RANGES:
            if lo <= cp <= hi:
                return True
    return False


class TransliterationService:
    """Stateless. Construct once, call .to_iast(text) per block.

    Falls back to None when the input has no Devanagari characters —
    that way page-number-only or all-Roman blocks don't get a
    spurious iast_text == block_content row.
    """

    def to_iast(self, text: str) -> str | None:
        if not text:
            return None
        if not _has_devanagari(text):
            return None
        return sanscript.transliterate(text, sanscript.DEVANAGARI, sanscript.IAST)


if __name__ == "__main__":
    svc = TransliterationService()

    cases: list[tuple[str, str | None]] = [
        # verse with numbered closer and avagraha
        (
            "तेऽरण्याद्ग्राममानीता भयशोकसमन्विताः ॥ १९७ ॥",
            "te'raṇyādgrāmamānītā bhayaśokasamanvitāḥ || 197 ||",
        ),
        # anusvara, visarga, dandas
        (
            "ॐ भवाय स्वाहा । भुर्भूवः स्वाहा ।",
            "oṃ bhavāya svāhā | bhurbhūvaḥ svāhā |",
        ),
        # footnote code with Devanagari digit
        (
            "१ क. ०तान् ॥ १९७ ॥",
            "1 ka. 0tān || 197 ||",
        ),
        # heading-like with closing danda
        (
            "इत्यसंसक्तानाहः ॥",
            "ityasaṃsaktānāhaḥ ||",
        ),
        # parens + digits
        (
            "( २६ )",
            "( 26 )",
        ),
        # empty
        ("", None),
        # whitespace-only (after strip would be empty; we don't strip)
        # but no Devanagari -> None
        ("   ", None),
        # pure ASCII -> None (don't pretend we transliterated it)
        ("ka.", None),
    ]
    failed = 0
    for src, expected in cases:
        got = svc.to_iast(src)
        ok = got == expected
        marker = "ok " if ok else "FAIL"
        print(f"{marker}  {src!r} -> {got!r}")
        if not ok:
            print(f"      expected: {expected!r}")
            failed += 1
    if failed:
        raise SystemExit(f"{failed} test(s) failed")
    print(f"transliteration smoke: ok ({len(cases)} cases)")
