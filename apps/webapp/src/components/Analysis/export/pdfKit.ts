import type { jsPDF } from "jspdf";
import { C, CONTENT_BOTTOM, CONTENT_TOP, type RGB } from "./pdfTheme.ts";

/**
 * The drawing primitives the document is written in.
 *
 * jsPDF's own API is stateful and low level, so every call here sets what it needs and nothing
 * leaks between calls. Text is placed from its TOP edge rather than its baseline, which is what
 * makes a cursor-driven layout possible to reason about.
 */

export interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: RGB;
  align?: "left" | "center" | "right";
  /** Extra tracking, for the small capitalised labels the page sets in Fira. */
  spacing?: number;
}

const DEFAULT_SIZE = 9;

/**
 * What the built-in PDF fonts can actually print.
 *
 * jsPDF's standard fonts are WinAnsi encoded, so anything outside Latin-1 comes out as the wrong
 * glyph rather than as nothing, which is worse: a minus sign typed as U+2212 printed as a macron,
 * and a track called "Mod ē m" came out mangled. Accents are folded onto their base letters, the
 * few typographic characters the app uses are mapped to their Latin-1 twins, and whatever is still
 * unprintable is dropped rather than drawn wrong.
 */
const SUBSTITUTES: Record<string, string> = {
  "−": "-", // minus sign
  "–": "-", // en dash
  "—": "-", // em dash
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "→": ">",
  "·": "·", // middle dot is Latin-1, kept as is
};

export function printable(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFKD")) {
    if (SUBSTITUTES[ch] !== undefined) {
      out += SUBSTITUTES[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x300 && code <= 0x36f) continue; // combining marks left by the decomposition
    if (code === 0x2026) {
      out += "…"; // ellipsis has a WinAnsi slot
      continue;
    }
    if (code <= 0xff) out += ch;
  }
  return out;
}

function applyFont(doc: jsPDF, o: TextOpts): void {
  doc.setFont("helvetica", o.bold ? "bold" : "normal");
  doc.setFontSize(o.size ?? DEFAULT_SIZE);
  const c = o.color ?? C.ink;
  doc.setTextColor(c[0], c[1], c[2]);
}

export function text(doc: jsPDF, s: string, x: number, y: number, o: TextOpts = {}): void {
  const out = printable(s ?? "");
  if (!out) return;
  applyFont(doc, o);
  doc.text(out, x, y, { baseline: "top", align: o.align ?? "left", charSpace: o.spacing ?? 0 });
}

/** Width of `s` as it would be drawn, tracking included. */
export function widthOf(doc: jsPDF, s: string, o: TextOpts = {}): number {
  const out = printable(s ?? "");
  applyFont(doc, o);
  return doc.getTextWidth(out) + (o.spacing ?? 0) * Math.max(0, out.length - 1);
}

export function wrap(doc: jsPDF, s: string, width: number, o: TextOpts = {}): string[] {
  applyFont(doc, o);
  return doc.splitTextToSize(printable(s ?? ""), width) as string[];
}

/** One line cut to `width`, with an ellipsis, for a field that must stay on one line. */
export function ellipsis(doc: jsPDF, s: string, width: number, o: TextOpts = {}): string {
  if (widthOf(doc, s, o) <= width) return s;
  let cut = s;
  while (cut.length > 1 && widthOf(doc, `${cut}…`, o) > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export function paragraph(
  doc: jsPDF,
  s: string,
  x: number,
  y: number,
  width: number,
  o: TextOpts & { leading?: number } = {},
): number {
  const lines = wrap(doc, s, width, o);
  const leading = o.leading ?? (o.size ?? DEFAULT_SIZE) * 1.55;
  lines.forEach((line, i) => text(doc, line, x, y + i * leading, o));
  return lines.length * leading;
}

/** A line of text made of runs, some of which are links. Returns the width drawn. */
export function richLine(
  doc: jsPDF,
  parts: { text: string; color?: RGB; url?: string; bold?: boolean }[],
  x: number,
  y: number,
  o: TextOpts = {},
): number {
  let cx = x;
  for (const part of parts) {
    const opts = { ...o, color: part.color ?? o.color, bold: part.bold ?? o.bold };
    applyFont(doc, opts);
    const body = printable(part.text);
    if (part.url) {
      doc.textWithLink(body, cx, y, { url: part.url, baseline: "top" });
      const w = doc.getTextWidth(body);
      // An underline, so a printed copy still reads as a link.
      const c = opts.color ?? C.accent;
      line(doc, cx, y + (opts.size ?? DEFAULT_SIZE) * 1.12, cx + w, y + (opts.size ?? DEFAULT_SIZE) * 1.12, c, 0.4);
      cx += w;
    } else {
      doc.text(body, cx, y, { baseline: "top" });
      cx += doc.getTextWidth(body);
    }
  }
  return cx - x;
}

export function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: RGB, radius = 0): void {
  if (w <= 0 || h <= 0) return;
  doc.setFillColor(color[0], color[1], color[2]);
  if (radius > 0) doc.roundedRect(x, y, w, h, radius, radius, "F");
  else doc.rect(x, y, w, h, "F");
}

export function strokeRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGB,
  radius = 0,
  width = 0.5,
): void {
  if (w <= 0 || h <= 0) return;
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
  if (radius > 0) doc.roundedRect(x, y, w, h, radius, radius, "S");
  else doc.rect(x, y, w, h, "S");
}

/** A bordered panel in the page's card language. */
export function card(doc: jsPDF, x: number, y: number, w: number, h: number, fill: RGB = C.card): void {
  fillRect(doc, x, y, w, h, fill, 4);
  strokeRect(doc, x, y, w, h, C.line, 4);
}

export function line(
  doc: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: RGB,
  width = 0.5,
  dash?: number[],
): void {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
  if (dash) doc.setLineDashPattern(dash, 0);
  doc.line(x1, y1, x2, y2);
  if (dash) doc.setLineDashPattern([], 0);
}

export interface Point {
  x: number;
  y: number;
}

/** A filled polygon from absolute points, optionally outlined. jsPDF takes deltas, so this converts. */
export function polygon(doc: jsPDF, pts: Point[], color: RGB, stroke?: RGB, strokeWidth = 0.4): void {
  if (pts.length < 3) return;
  const deltas: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) deltas.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
  doc.setFillColor(color[0], color[1], color[2]);
  if (stroke) {
    doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
    doc.setLineWidth(strokeWidth);
  }
  doc.lines(deltas, pts[0].x, pts[0].y, [1, 1], stroke ? "FD" : "F", true);
}

export function polyline(doc: jsPDF, pts: Point[], color: RGB, width = 0.7): void {
  if (pts.length < 2) return;
  const deltas: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) deltas.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
  doc.lines(deltas, pts[0].x, pts[0].y, [1, 1], "S", false);
}

/**
 * One wedge of a ring, as a polygon. Both the Camelot wheel and the stem donut are rings of these,
 * and an arc approximated by 10 straight steps over 30° is indistinguishable at print size.
 */
export function annulusSegment(
  doc: jsPDF,
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a0: number,
  a1: number,
  color: RGB,
  steps = 10,
  stroke?: RGB,
): void {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: cx + Math.cos(a) * rOuter, y: cy + Math.sin(a) * rOuter });
  }
  for (let i = steps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: cx + Math.cos(a) * rInner, y: cy + Math.sin(a) * rInner });
  }
  polygon(doc, pts, color, stroke);
}

export function image(doc: jsPDF, png: Uint8Array, x: number, y: number, w: number, h: number, alias: string): void {
  doc.addImage(png, "PNG", x, y, w, h, alias, "NONE");
}

export interface SectionMark {
  page: number;
  start: number;
  end: number;
  /** The section ran onto the next page, so the page it started on has no room left to give. */
  brokePage: boolean;
}

/**
 * The cursor the document is laid out with.
 *
 * Sections say how much room they need before they draw, and the page turns when they do not fit.
 * Nothing is ever split across a page boundary, because every section knows its own height.
 *
 * `begin` and `end` around each section are what make the document fill its pages. The first pass
 * records where every section landed, `computeSpread` turns the leftover at the foot of each page
 * into extra air between the sections on it, and the second pass draws with that applied. Without
 * it a four-page export has four ragged bottoms, which reads as a document that ran out rather
 * than one that was set.
 */
export class Layout {
  y = CONTENT_TOP;
  page = 1;
  readonly marks: SectionMark[] = [];
  private index = -1;
  private startY = CONTENT_TOP;
  private startPage = 1;

  constructor(
    readonly doc: jsPDF,
    private readonly spread: number[] = [],
  ) {}

  begin(): void {
    this.index++;
    this.y += this.spread[this.index] ?? 0;
    this.startY = this.y;
    this.startPage = this.page;
  }

  end(): void {
    const broke = this.page !== this.startPage;
    // Recorded against the page it FINISHED on. A section that turned the page mid-way belongs to
    // the new one, and the page it left behind is then measured by whatever ended there instead of
    // being written off as full, which is what left a third of a sheet empty.
    this.marks.push({
      page: this.page,
      start: broke ? CONTENT_TOP : this.startY,
      end: this.y,
      brokePage: broke,
    });
  }

  /** Start a new page unless `h` still fits under the cursor. */
  ensure(h: number): void {
    if (this.y + h <= CONTENT_BOTTOM) return;
    this.newPage();
  }

  newPage(): void {
    this.doc.addPage("a4", "portrait");
    paintPage(this.doc);
    this.page += 1;
    this.y = CONTENT_TOP;
  }

  /** Room left on this page. */
  get left(): number {
    return CONTENT_BOTTOM - this.y;
  }

  gap(h: number): void {
    this.y += h;
  }
}

/**
 * How much extra air to put before each section so its page fills.
 *
 * Capped, because a page holding one short section should end where it ends rather than float its
 * two paragraphs half a page apart. Whatever is left over after the cap stays at the foot.
 */
export function computeSpread(marks: SectionMark[], maxSpread = 150): number[] {
  const spread = new Array(marks.length).fill(0);
  const byPage = new Map<number, number[]>();
  marks.forEach((m, i) => {
    const list = byPage.get(m.page) ?? [];
    list.push(i);
    byPage.set(m.page, list);
  });
  for (const indices of byPage.values()) {
    const last = marks[indices[indices.length - 1]];
    if (indices.length < 2) continue;
    const slack = CONTENT_BOTTOM - last.end - 8;
    if (slack <= 0) continue;
    const each = Math.min(maxSpread, slack / (indices.length - 1));
    for (let k = 1; k < indices.length; k++) spread[indices[k]] = each;
  }
  return spread;
}

/** The black sheet and the dotted side lines the site frames every page with. */
export function paintPage(doc: jsPDF): void {
  const { pageWidth, pageHeight } = { pageWidth: doc.internal.pageSize.getWidth(), pageHeight: doc.internal.pageSize.getHeight() };
  fillRect(doc, 0, 0, pageWidth, pageHeight, C.page);
}
