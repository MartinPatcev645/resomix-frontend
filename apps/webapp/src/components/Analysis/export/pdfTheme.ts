/**
 * Page geometry and palette for the analysis PDF.
 *
 * Everything is in PostScript points, because the PDF is drawn directly rather than photographed
 * from a page: A4 is 595.28 × 841.89 of them. The colours are the literal hex behind the `--an-*`
 * and `--section-*` tokens, since a PDF has no cascade to resolve a custom property through. When
 * a token changes in `styles/analysis.css` or `styles/sections.css`, it changes here too.
 */

export type RGB = [number, number, number];

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

/**
 * The side inset. The site frames every page with dotted lines at `--px-63` of a 1280px canvas,
 * which is 4.9% of the width, and this is that same share of A4 so the document keeps the site's
 * margins rather than a printer's.
 */
export const MARGIN_X = 29;
export const MARGIN_TOP = 32;
export const FOOTER_H = 30;

export const CONTENT_W = PAGE_W - MARGIN_X * 2;
export const CONTENT_TOP = MARGIN_TOP;
export const CONTENT_BOTTOM = PAGE_H - FOOTER_H;
export const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;

export function hexRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** `fg` at `alpha` over `bg`, flattened. A PDF fill with no alpha state is smaller and faster. */
export function blend(fg: RGB, bg: RGB, alpha: number): RGB {
  const a = Math.max(0, Math.min(1, alpha));
  return [0, 1, 2].map((i) => Math.round(bg[i] + (fg[i] - bg[i]) * a)) as RGB;
}

export const C = {
  /** The site's own background (`--color-secondary`), so the paper is the page. */
  page: hexRgb("#000000"),
  ink: hexRgb("#f2efec"),
  inkStrong: hexRgb("#d8d2cd"),
  inkSoft: hexRgb("#9a938e"),
  inkMuted: hexRgb("#7d7772"),
  inkFaint: hexRgb("#5a554f"),
  line: hexRgb("#1c1c1c"),
  rule: hexRgb("#161616"),
  grid: hexRgb("#2a2a2a"),
  card: hexRgb("#111111"),
  lane: hexRgb("#0e0e0e"),
  accent: hexRgb("#EE4A26"),
  pitch: hexRgb("#4fd1e0"),
  flagBg: hexRgb("#2a2308"),
  flagFg: hexRgb("#ffd166"),
  tagHotBg: hexRgb("#341d0d"),
  tagHotFg: hexRgb("#ff8c42"),
  tagBg: hexRgb("#111111"),
  tagFg: hexRgb("#d8d2cd"),
  tagEdge: hexRgb("#2a2a2a"),
} as const;

/** `--an-stem-*`, the same four values `STEM_COLORS` uses for the canvas fills. */
export const STEM_RGB: Record<string, RGB> = {
  drums: hexRgb("#ff8c42"),
  bass: hexRgb("#6f9bff"),
  other: hexRgb("#4fd1e0"),
  vocals: hexRgb("#b48cff"),
};

export const METER_RGB: Record<string, RGB> = {
  danceable: hexRgb("#ff8c42"),
  electronic: hexRgb("#ff8c42"),
  vocal: hexRgb("#b48cff"),
  approachable: hexRgb("#d6e34a"),
  bright: hexRgb("#4fd1e0"),
  acoustic: hexRgb("#9fb3c8"),
};

/**
 * `--section-*`, keyed by the DISPLAYED word, exactly as `utils/sectionColors.ts` keys them. A word
 * with no entry is drawn as "part", which is the same fallback the strip on screen uses.
 */
export const SECTION_TONES: Record<string, { bg: RGB; fg: RGB }> = {
  intro: { bg: hexRgb("#0c2a30"), fg: hexRgb("#4fd1e0") },
  opening: { bg: hexRgb("#0c2a30"), fg: hexRgb("#3fbccb") },
  build: { bg: hexRgb("#262b0e"), fg: hexRgb("#d6e34a") },
  swell: { bg: hexRgb("#262b0e"), fg: hexRgb("#c2d13a") },
  drop: { bg: hexRgb("#38120d"), fg: hexRgb("#ff5a36") },
  main: { bg: hexRgb("#38120d"), fg: hexRgb("#f26a42") },
  full: { bg: hexRgb("#38120d"), fg: hexRgb("#e4643f") },
  groove: { bg: hexRgb("#341d0d"), fg: hexRgb("#ff8c42") },
  part: { bg: hexRgb("#341d0d"), fg: hexRgb("#e09a6a") },
  breakdown: { bg: hexRgb("#201637"), fg: hexRgb("#b48cff") },
  break: { bg: hexRgb("#201637"), fg: hexRgb("#c9a8ff") },
  sparse: { bg: hexRgb("#201637"), fg: hexRgb("#9c7fe0") },
  cooldown: { bg: hexRgb("#111a33"), fg: hexRgb("#6f9bff") },
  "wind-down": { bg: hexRgb("#111a33"), fg: hexRgb("#5f88e6") },
  fade: { bg: hexRgb("#111a33"), fg: hexRgb("#5476c4") },
  outro: { bg: hexRgb("#171c23"), fg: hexRgb("#9fb3c8") },
  closing: { bg: hexRgb("#171c23"), fg: hexRgb("#86979f") },
};

export function sectionTone(word: string): { bg: RGB; fg: RGB } {
  return SECTION_TONES[word.trim().toLowerCase()] ?? SECTION_TONES.part;
}

/** The magma-ish ramp the heatmaps on screen are drawn with (`colormap` in heatviz.tsx). */
const STOPS: [number, RGB][] = [
  [0.0, [8, 8, 18]],
  [0.35, [70, 24, 78]],
  [0.6, [170, 48, 60]],
  [0.8, [238, 96, 40]],
  [1.0, [255, 224, 150]],
];

export function colormap(t: number): RGB {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const f = (x - t0) / (t1 - t0 || 1);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as RGB;
    }
  }
  return STOPS[STOPS.length - 1][1];
}
