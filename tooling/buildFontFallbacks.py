#!/usr/bin/env python3
"""
Generate metric-matched fallback @font-face rules.

Run from the repo root:  python3 tooling/buildFontFallbacks.py

WHY THIS EXISTS
---------------
Making the site fast created a layout-shift problem.

Mobile FCP went from 10.7 s to 1.8 s. The page now paints BEFORE the web fonts arrive, so text is
first drawn in a system fallback and re-flows when the real font swaps in. Previously the page
painted so late that the fonts had already landed — the shift was always there, hidden inside the
slowness. PageSpeed measured CLS 0.191 mobile / 0.675 desktop against a 0.1 "good" threshold, and
named `FiraCode-Light.latin.woff2` for 0.176 of the mobile figure.

The wrong fixes, and why:

  preload every face      front-loads ~237 KiB and pushes FCP straight back up
  font-display: optional  no shift, but on a slow connection the brand font never applies
  font-display: block     trades the shift for invisible text

THE FIX
-------
Give each family a fallback @font-face that is a LOCAL system font stretched to occupy exactly the
same space as the web font. Then the swap changes glyph shapes but not a single line box, so it
costs zero CLS. This is what Next.js generates automatically; here it is computed explicitly.

  size-adjust        matches average glyph width, so a line breaks in the same place
  ascent-override    matches the space above the baseline
  descent-override   matches the space below it
  line-gap-override  matches the leading

Metrics are read from the REAL font binaries — both ours and the system fallbacks — rather than
copied from a table, so re-running this after a font change keeps them honest.
"""

from fontTools.ttLib import TTFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "fonts-src"

# System fonts chosen because they exist on effectively every macOS/Windows/Linux desktop, so the
# fallback resolves without a download. `local()` means it costs zero bytes.
FALLBACKS = {
    "arial": Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    "courier": Path("/System/Library/Fonts/Supplemental/Courier New.ttf"),
}

# family -> (representative face, fallback key, local() names to try in order)
# One fallback per FAMILY, matched to the face that actually gates first paint: body copy for
# Helvetica, the nav/eyebrow face for Fira Code, the hero <h1> for Benzin.
FAMILIES = [
    ("Helvetica_Neue Fallback", "HelveticaNeueLight.otf", "arial", ["Arial", "Helvetica"]),
    ("Fira Code Fallback", "FiraCode-Light.ttf", "courier", ["Courier New", "monospace"]),
    ("Benzin Fallback", "benzin-bold.ttf", "arial", ["Arial Bold", "Arial"]),
]


def metrics(path: Path) -> dict:
    """Ascent/descent/lineGap/avg width in font units, plus the em size they are relative to."""
    font = TTFont(str(path), lazy=True)
    head, hhea, os2 = font["head"], font["hhea"], font["OS/2"]

    # OS/2 sTypo* is the metric browsers use for line box geometry when USE_TYPO_METRICS is set;
    # hhea is the practical fallback and what capsize/Next.js read. Prefer hhea for consistency
    # with how Chrome lays these fonts out today.
    ascent, descent, line_gap = hhea.ascent, abs(hhea.descent), hhea.lineGap

    # Average width is MEASURED, not read from OS/2.xAvgCharWidth.
    #
    # That field is defined differently across OS/2 versions — v1 weights lowercase by English
    # letter frequency, v3+ averages every glyph in the font — so a ratio between two fonts on
    # different versions is meaningless. Arial (v3) reports 904 while its real lowercase average is
    # 1002.6; taking the field at face value made Helvetica Neue look 29 % wider than Arial, when
    # it is in fact fractionally narrower. Measuring the same glyphs in both fonts is comparable
    # by construction.
    cmap, hmtx = font.getBestCmap(), font["hmtx"]

    def sample(chars: str) -> float:
        widths = [
            hmtx[cmap[ord(c)]][0]
            for c in chars
            if ord(c) in cmap and cmap[ord(c)] in hmtx.metrics
        ]
        return sum(widths) / len(widths) if widths else 0.0

    # Lowercase carries most of the width in running text. Uppercase is the fallback for display
    # faces that ship no lowercase at all.
    avg = sample("abcdefghijklmnopqrstuvwxyz") or sample("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    if not avg:
        raise SystemExit(f"cannot measure glyph widths in {path.name}")

    return {"em": head.unitsPerEm, "ascent": ascent, "descent": descent,
            "lineGap": line_gap, "avg": avg, "os2": os2.version}


def pct(value: float) -> str:
    """CSS percentage, trimmed. Two decimals is well inside sub-pixel for any real font size."""
    return f"{round(value * 100, 2):g}%"


def main() -> None:
    fallback_metrics = {}
    for key, path in FALLBACKS.items():
        if not path.exists():
            raise SystemExit(f"missing system fallback: {path}")
        fallback_metrics[key] = metrics(path)

    blocks, summary = [], []
    for family, face, fb_key, locals_ in FAMILIES:
        face_path = SRC / face
        if not face_path.exists():
            raise SystemExit(f"missing source face: {face_path}")

        web, fb = metrics(face_path), fallback_metrics[fb_key]

        # How much wider/narrower our font is than the fallback, as a ratio of em.
        size_adjust = (web["avg"] / web["em"]) / (fb["avg"] / fb["em"])

        # Overrides are expressed against the ALREADY size-adjusted em, so divide them through.
        ascent = (web["ascent"] / web["em"]) / size_adjust
        descent = (web["descent"] / web["em"]) / size_adjust
        line_gap = (web["lineGap"] / web["em"]) / size_adjust

        src = ", ".join(f"local('{name}')" for name in locals_)
        blocks.append(
            f"@font-face {{\n"
            f"    font-family: '{family}';\n"
            f"    src: {src};\n"
            f"    size-adjust: {pct(size_adjust)};\n"
            f"    ascent-override: {pct(ascent)};\n"
            f"    descent-override: {pct(descent)};\n"
            f"    line-gap-override: {pct(line_gap)};\n"
            f"}}"
        )
        summary.append(f"  {family:26s} from {face:28s} size-adjust {pct(size_adjust)}")

    header = (
        "/* GENERATED by tooling/buildFontFallbacks.py — do not edit. Re-run after any font change. */\n"
        "/* ---------------------------------------------------------------------------------\n"
        "   Metric-matched fallbacks — GENERATED by tooling/buildFontFallbacks.py, do not edit.\n"
        "\n"
        "   Each rule takes a system font that is already on the machine (so it costs no bytes)\n"
        "   and stretches its metrics to match the web font exactly. Text drawn in the fallback\n"
        "   therefore occupies the same space as the real thing, and the swap re-flows nothing.\n"
        "\n"
        "   This is the fix for the CLS that our own speed-up exposed: the page now paints before\n"
        "   the fonts arrive, so the swap became visible where it used to be hidden by slowness.\n"
        "   --------------------------------------------------------------------------------- */"
    )

    css = (
        header
        + "\n\n"
        + "\n\n".join(blocks)
        + "\n\n/* computed:\n"
        + "\n".join(summary)
        + "\n*/\n"
    )

    # Its own file, NOT fonts.css: `buildFonts.py` regenerates fonts.css from the source faces on
    # every run and would wipe anything added there. The utility-class stacks that NAME these
    # families do live in fonts.css, inside the block that script preserves verbatim.
    for app in ("landing", "webapp"):
        target = ROOT / f"apps/{app}/src/styles/font-fallbacks.css"
        target.write_text(css, encoding="utf-8")
        print(f"wrote {target.relative_to(ROOT)}")

    print("\n".join(summary))


if __name__ == "__main__":
    main()
