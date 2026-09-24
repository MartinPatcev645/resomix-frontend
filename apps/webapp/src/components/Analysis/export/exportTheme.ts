/**
 * Page geometry and the token pin for the PDF export.
 *
 * The export renders into a hidden DOM tree and is photographed page by page, so every size here
 * is a CSS pixel at the browser's own 96-per-inch layout resolution: A4 is 794 × 1123 of them.
 * jsPDF measures in PostScript points instead, hence the second pair and the conversion.
 */

/** A4 at 96 CSS px per inch, the ratio the browser lays out at. */
export const PAGE_W = 794;
export const PAGE_H = 1123;
/** The same page in PostScript points, which is what jsPDF places images in. */
export const PAGE_W_PT = 595.28;
export const PAGE_H_PT = 841.89;
export const PX_TO_PT = PAGE_W_PT / PAGE_W;

/**
 * The side inset. The site frames every page with dotted lines at `--px-63` of a 1280px canvas
 * (4.9%), and this is that same proportion of an A4 page, so the document keeps the site's margins
 * rather than a printer's.
 */
export const SIDE_MARGIN = 39;
export const TOP_PADDING = 34;
export const FOOTER_H = 42;
export const CONTENT_W = PAGE_W - SIDE_MARGIN * 2;
export const CONTENT_H = PAGE_H - TOP_PADDING - FOOTER_H;

/**
 * Blocks are spaced apart by at least the first and at most the second, filling the page.
 *
 * Sections flow rather than each starting on a fresh sheet, so the floor has to be enough air for
 * a section heading to read as a new section when it lands mid-page.
 */
export const BLOCK_GAP_MIN = 20;
export const BLOCK_GAP_MAX = 56;

/** The site's own background (`--color-secondary`), so the paper is the page. */
export const PAGE_BG = "#000000";

/** The root font size every `--px-*` token is authored against. */
export const BASE_REM = 16;

/** How much bitmap is captured per CSS pixel. 2.5 ≈ 240 dpi on A4. */
export const CAPTURE_SCALE = 2.5;

const PX_TOKEN = /^--px-/;

/**
 * Every `--px-*` token, resolved to absolute pixels at the design root size.
 *
 * The tokens are `n/16 rem`, so they track the fluid root font-size the app sets
 * (`clamp(12.8px, 1.25vw, 16px)` and a different clamp below 1024px). That is right for a viewport
 * and wrong for a sheet of paper: exporting from a phone would otherwise draw the whole document
 * at 10/16 of its intended size. Redeclaring the tokens on the export root pins them for that
 * subtree only, and leaves the live page untouched.
 *
 * Names come from the stylesheets themselves rather than a copy of the list, because the list is
 * long and grows. Integers are seeded first so a token the enumeration cannot reach (a stylesheet
 * the browser refuses to expose) still resolves to something sane instead of invalidating every
 * declaration that mentions it.
 */
export function pinnedPixelTokens(baseRem: number = BASE_REM): Record<string, string> {
  const out: Record<string, string> = {};
  for (let n = 1; n <= 400; n++) out[`--px-${n}`] = `${n}px`;

  const names = new Set<string>();
  const visit = (rules: CSSRuleList | undefined) => {
    for (const rule of Array.from(rules ?? [])) {
      const style = (rule as CSSStyleRule).style;
      if (style) {
        for (let i = 0; i < style.length; i++) {
          const prop = style[i];
          if (PX_TOKEN.test(prop)) names.add(prop);
        }
      }
      const nested = (rule as CSSGroupingRule).cssRules;
      if (nested) visit(nested);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    // A cross-origin stylesheet throws on .cssRules. Nothing of ours is, but a browser extension's
    // sheet can be, and it must not take the export down with it.
    try {
      visit(sheet.cssRules);
    } catch {
      /* not readable — skip */
    }
  }

  const cs = getComputedStyle(document.documentElement);
  names.forEach((name) => {
    const raw = cs.getPropertyValue(name).trim();
    const rem = /^(-?[\d.]+)rem$/.exec(raw);
    if (rem) out[name] = `${parseFloat(rem[1]) * baseRem}px`;
    else if (raw) out[name] = raw;
  });
  return out;
}

/** The pinned tokens as a CSS rule body, for a `<style>` tag scoped to the export root. */
export function pinnedTokenCss(selector: string, baseRem: number = BASE_REM): string {
  const tokens = pinnedPixelTokens(baseRem);
  const body = Object.entries(tokens)
    .map(([name, value]) => `${name}:${value};`)
    .join("");
  return `${selector}{${body}}`;
}
