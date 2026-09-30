import type { jsPDF } from "jspdf";
import { shortGenre } from "@resomix/hooks";
import type { AnalysisData, ScoredLabel } from "@/pages/analysis/data.ts";
import { chromaLabelsForKey, keyFromCamelot } from "@/pages/analysis/heatviz.tsx";
import {
  barMeans,
  barsFromDownbeats,
  camelotNeighbours,
  camelotRootPitchClass,
  inKeyPitchClasses,
  lufsFrac,
  meanChromaFromMatrix,
  meanInRange,
} from "@/utils/analysisTimeline.ts";
import { abbreviateSectionLabel, sectionAtMs, sectionWord } from "@/utils/structureStrip.ts";
import { chromaPng, spectrogramPng } from "./pdfImages.ts";
import {
  annulusSegment,
  card,
  computeSpread,
  ellipsis,
  fillRect,
  image,
  Layout,
  line,
  paintPage,
  paragraph,
  polygon,
  polyline,
  richLine,
  strokeRect,
  text,
  widthOf,
  wrap,
  type Point,
} from "./pdfKit.ts";
import {
  blend,
  C,
  CONTENT_BOTTOM,
  CONTENT_TOP,
  CONTENT_W,
  FOOTER_H,
  MARGIN_X,
  METER_RGB,
  PAGE_H,
  PAGE_W,
  sectionTone,
  STEM_RGB,
  type RGB,
} from "./pdfTheme.ts";

/**
 * The analysis, drawn as a PDF.
 *
 * Every mark on the page is placed here rather than photographed from the screen. That is a
 * deliberate second implementation of the same readings, and it buys three things the first
 * approach could not: the text is real text a reader can select and search, the whole document is
 * built from numbers in a few hundred milliseconds on any device, and nothing in it depends on the
 * browser being willing to render a hidden DOM tree into an image, which is exactly the step that
 * has no support worth relying on across phones.
 *
 * The one thing it does not do is reuse the React components, so a change to how a lane looks on
 * screen does not follow it here. The colours, the ramp and the lane order are all pulled from the
 * same tokens and helpers the page uses, and the two heatmaps mirror the page's own maths, so the
 * two stay recognisably the same picture.
 */

/* ------------------------------------------------------------------ helpers */

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtBpm = (b: number) => (Number.isInteger(b) ? String(b) : b.toFixed(1));
const fmtHz = (hz: number) => (hz >= 1000 ? `${Math.round(hz / 1000)}k` : `${Math.round(hz)}`);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A timestamp as "27 September 2026, 14:05 UTC".
 *
 * UTC so the two dates on an export mean the same thing to whoever it is forwarded to, wherever
 * they are. Built by hand rather than with `toLocaleString`, whose month abbreviations and
 * separators change with the browser's ICU data ("Sept" in some builds, "Sep" in others).
 */
export function formatUtc(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export interface TrackFacts {
  title: string;
  artist: string | null;
  file: string;
}

/**
 * Artist and title out of the filename.
 *
 * The analysis result carries the uploaded filename and nothing else, so this reads the one
 * convention the files actually follow, "Artist - Title (Mix).mp3" and sometimes a track number in
 * front, and claims nothing it cannot support. No separator means no artist.
 */
export function trackFacts(filename: string): TrackFacts {
  const file = filename || "Untitled";
  // Every audio extension on the end, since files arrive as "…mp3.mpeg" too.
  const noExt = file.replace(/(\.(mp3|wav|flac|aiff?|m4a|ogg|mpe?g))+$/i, "");
  // A download site's watermark on the end: "-electrobuzz.net", " (www.site.com)", "[site.ru]".
  // A real title does not end in a domain, so this cannot eat one.
  const noSite = noExt.replace(/[\s\-_]*[[(]?(?:www\.)?[a-z0-9-]+\.(?:net|com|org|ru|to|cc|me|io|info|biz)[\])]?\s*$/i, "");
  // The track number: "02. ", "04-", "3 - ". Two or three digits may be glued straight to the
  // artist ("04-Avocado"); a single digit needs a space after it, so "2-Step" keeps its name.
  const noIndex = noSite.replace(/^\s*(?:\d{2,3}\s*[.\-_)]\s*|\d\s*[.\-_)]\s+)/, "");
  const split = noIndex.split(/\s+-\s+/);
  if (split.length >= 2) {
    const artist = split[0].trim();
    const title = split.slice(1).join(" - ").trim();
    if (artist && title) return { title, artist, file };
  }
  return { title: noIndex.trim() || file, artist: null, file };
}

export interface PdfMeta {
  exportedOn: string;
  landingUrl: string;
  betaUrl: string;
}

/* ------------------------------------------------------------- lane geometry */

const GUTTER = 58;
const GAP_X = 7;
const AXIS = 20;
const CHART_X = MARGIN_X + GUTTER + GAP_X;
const CHART_W = CONTENT_W - GUTTER - GAP_X - GAP_X - AXIS;
const AXIS_X = CHART_X + CHART_W + GAP_X;

/** Lane heights at full size. The whole stack is scaled together when a track needs more rows. */
const LANE = { ruler: 11, structure: 34, energy: 58, spectrum: 74, pitch: 46, row: 10, rowGap: 2, stems: 56, gap: 9 };

/* ------------------------------------------------------------------ document */

/** The two heatmaps, encoded once and drawn into both passes. */
interface Plates {
  spectrum: ReturnType<typeof spectrogramPng>;
  chroma: ReturnType<typeof chromaPng>;
}

/**
 * Draw the document.
 *
 * It is laid out twice. The first pass records where every section landed so the leftover at the
 * foot of each page can be given back as spacing between its sections; the second draws the real
 * thing. Both passes are pure arithmetic over the same numbers, and the two pictures that are
 * genuinely pixels are encoded once and shared, so the whole export is a fraction of a second.
 */
export function buildAnalysisPdf(makeDoc: () => jsPDF, data: AnalysisData, meta: PdfMeta): jsPDF {
  const facts = trackFacts(data.identity.filename);
  const title = facts.artist ? `${facts.artist} · ${facts.title}` : facts.title;
  const plates: Plates = {
    spectrum: spectrogramPng(
      data.spectral.linearSpectrogram ?? data.spectral.melSpectrogram,
      data.identity.sampleRateHz,
      !!data.spectral.linearSpectrogram,
    ),
    chroma: chromaPng(data.tonality.chromagram),
  };

  const probe = layout(makeDoc(), data, facts, meta, plates, []);
  const pages = probe.doc.getNumberOfPages();
  const spread = computeSpread(probe.marks);

  // Spacing a page out can, at the margin, push its last section over the edge and add a sheet:
  // a section asks for room before it draws and sometimes asks for a little more than it takes.
  // Rather than reason about every one of those, try the spacing and keep it only if the document
  // still has the same number of pages, easing off until it does. Each attempt is a few tens of
  // milliseconds of arithmetic.
  let out = probe;
  for (const factor of [1, 0.6, 0.3]) {
    const attempt = layout(makeDoc(), data, facts, meta, plates, spread.map((s) => s * factor));
    if (attempt.doc.getNumberOfPages() === pages) {
      out = attempt;
      break;
    }
  }

  drawFurniture(out.doc, title);
  return out.doc;
}

function layout(
  doc: jsPDF,
  data: AnalysisData,
  facts: TrackFacts,
  meta: PdfMeta,
  plates: Plates,
  spread: number[],
): Layout {
  paintPage(doc);
  const L = new Layout(doc, spread);

  const section = (draw: () => void, tight = false) => {
    L.begin(tight);
    draw();
    L.end();
  };

  section(() => drawCover(L, data, facts, meta, plates));
  // The facts table and the stat cards are one block: they are the same statement about the track
  // and a page turn or a gap between them would read as two.
  section(() => {
    drawFacts(L, data, facts, meta);
    drawStats(L, data);
  });
  // The Timeline always opens a sheet of its own, and the turn happens outside the section so the
  // page it leaves behind is still counted as having room to spread.
  L.newPage();
  section(() => drawTimeline(L, data, plates));
  section(() => drawHarmony(L, data));
  section(() => drawVibe(L, data));
  section(() => drawGenre(L, data));
  if (hasReadings(data)) section(() => drawReadings(L, data));
  // The closing note is a footnote to whatever precedes it, so it never floats away from it.
  section(() => drawClosing(L), true);

  return L;
}

/* --------------------------------------------------------------------- cover */

function drawCover(L: Layout, data: AnalysisData, facts: TrackFacts, meta: PdfMeta, plates: Plates): void {
  const { doc } = L;
  const x = MARGIN_X;

  text(doc, "RESOMIX · TRACK INTELLIGENCE", x, L.y, { size: 7, color: C.accent, spacing: 1.6 });
  L.gap(20);

  const titleOpts = { size: 24, bold: true, color: C.ink };
  const lines = wrap(doc, facts.title.toUpperCase(), CONTENT_W, titleOpts);
  lines.forEach((l, i) => text(doc, l, x, L.y + i * 27, titleOpts));
  L.gap(lines.length * 27 + 2);

  if (facts.artist) {
    text(doc, facts.artist, x, L.y, { size: 12, color: C.inkSoft });
    L.gap(20);
  }

  L.gap(8);
  line(doc, x, L.y, x + CONTENT_W, L.y, C.line, 0.6);
  L.gap(18);

  const body = { size: 9.5, color: C.inkSoft } as const;
  L.gap(
    paragraph(
      doc,
      "This is a track analysis exported from Resomix, a music similarity search and audio analysis " +
        "platform for electronic music. Drop one track and it reveals the track's identity, its closest " +
        "sonic relatives and its place within a music catalogue.",
      x,
      L.y,
      400,
      { ...body, leading: 15 },
    ),
  );
  L.gap(10);
  L.gap(
    paragraph(
      doc,
      "Everything on the pages that follow was measured or predicted from the audio itself.",
      x,
      L.y,
      400,
      { ...body, leading: 15 },
    ),
  );
  L.gap(4);
  richLine(
    doc,
    [
      { text: "The live reading of this track is at ", color: C.inkSoft },
      { text: "beta.resomix.com", color: C.accent, url: meta.betaUrl },
      { text: ". More about the platform is at ", color: C.inkSoft },
      { text: "resomix.com", color: C.accent, url: meta.landingUrl },
      { text: ".", color: C.inkSoft },
    ],
    x,
    L.y,
    body,
  );
  L.gap(24);
  L.gap(drawHero(doc, x, L.y, CONTENT_W, data, plates));

  const contents: [string, string, string][] = [
    ["01", "Timeline", "structure, energy, spectrum, pitch, style, mood, stems"],
    ["02", "Harmony", "key, mix-compatible keys, note energy"],
    ["03", "Vibe", "valence, arousal, perceptual profile, mood"],
    ["04", "Genre & Sonic Style", "two ranked readings"],
  ];
  const colW = (CONTENT_W - 3 * 14) / 4;
  contents.forEach(([n, name, what], i) => {
    const cx = x + i * (colW + 14);
    text(doc, n, cx, L.y, { size: 7.5, color: C.accent, spacing: 0.8 });
    const nameLines = wrap(doc, name, colW, { size: 9.5, color: C.ink });
    nameLines.forEach((l, k) => text(doc, l, cx, L.y + 12 + k * 12, { size: 9.5, color: C.ink }));
    const whatLines = wrap(doc, what, colW, { size: 6.8, color: C.inkFaint });
    whatLines.forEach((l, k) => text(doc, l, cx, L.y + 12 + nameLines.length * 12 + 3 + k * 9, { size: 6.8, color: C.inkFaint }));
  });
  L.gap(64);

  text(doc, `Exported ${meta.exportedOn}`, x, L.y, { size: 7.5, color: C.inkFaint, spacing: 0.4 });
  L.gap(24);
}

/**
 * The track at a glance, across the foot of the cover.
 *
 * The cover otherwise carries nothing but type, and a page of type with a gap in it reads as a
 * page that ran out. This is the one picture that says what the track IS in a glance: its sections
 * in their own colours, and the energy underneath them on the same time axis. Both are drawn by
 * the same code the Timeline uses, just across the full width instead of a lane.
 *
 * Nothing is invented for it. A result with no structure and no beat grid has no glance to show,
 * so it draws nothing and the page closes up around it.
 */
function drawHero(doc: jsPDF, x: number, y: number, w: number, data: AnalysisData, plates: Plates): number {
  const durationMs = data.identity.durationMs;
  const segments = data.energy.structureSegments;
  const hasBeat = (data.rhythm.downbeatsSeconds?.length ?? 0) > 0;
  if (durationMs <= 0 || (!segments.length && !hasBeat)) return 0;

  const structureH = 32;
  const energyH = 74;
  const spectrumH = 58;
  const rulerH = 11;
  let cy = y;

  if (segments.length) {
    drawStructure(doc, cy, structureH, segments, durationMs, x, w);
    cy += structureH + 3;
  }
  drawEnergy(doc, cy, energyH, data, durationMs, x, w);
  cy += energyH + 3;
  if (plates.spectrum) {
    image(doc, plates.spectrum.data, x, cy, w, spectrumH, "an-hero-spectrum");
    cy += spectrumH;
  }
  drawRuler(doc, cy, rulerH, durationMs, false, x, w);
  cy += rulerH;

  return cy - y + 10;
}

/* ---------------------------------------------------------------- the track */

function drawFacts(L: Layout, data: AnalysisData, facts: TrackFacts, meta: PdfMeta): void {
  const { doc } = L;
  // A row we cannot fill is left out rather than printed as a placeholder. "Artist: not in the
  // filename" read to a professional reviewer as a fault in the report.
  const rows: [string, string][] = [
    ["Title", facts.title],
    ...(facts.artist ? ([["Artist", facts.artist]] as [string, string][]) : []),
    ["File", facts.file],
    ["Length", clock(data.identity.durationMs)],
    [
      "Format",
      [
        (data.identity.codec || "audio").toUpperCase(),
        data.identity.bitRate ? `${Math.round(data.identity.bitRate / 1000)} kbps` : null,
        data.identity.channels === 2 ? "stereo" : "mono",
        data.identity.sampleRateHz ? `${data.identity.sampleRateHz / 1000} kHz` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    // When the audio was analysed and when this copy was made are different moments, and both
    // matter once a PDF is forwarded: the first says how current the reading is.
    ...(data.analyzedAt != null ? ([["Analysed", formatUtc(data.analyzedAt)]] as [string, string][]) : []),
    ["Exported", meta.exportedOn],
  ];
  L.ensure(26 + rows.length * 16);
  sectionHead(L, "—", "The track");

  const x = MARGIN_X;
  rows.forEach(([label, value]) => {
    text(doc, label.toUpperCase(), x, L.y + 3, { size: 6.5, color: C.inkMuted, spacing: 0.9 });
    const opts = { size: 9.5, color: C.ink } as const;
    text(doc, ellipsis(doc, value, CONTENT_W - 78, opts), x + 78, L.y + 2, opts);
    L.gap(15);
    line(doc, x, L.y, x + CONTENT_W, L.y, C.rule, 0.5);
    L.gap(1);
  });
  L.gap(16);
}

/* ---------------------------------------------------------------- stat cards */

function drawStats(L: Layout, data: AnalysisData): void {
  const { doc } = L;
  const keyLabel = keyFromCamelot(data.tonality.camelot);
  const topGenre: ScoredLabel[] = data.semantics.styleMaestTop?.length
    ? data.semantics.styleMaestTop
    : data.semantics.genreTop ?? [];
  const segments = data.energy.structureSegments;
  const sections = segments.filter((s) => !s.hidden).length;
  const bars = segments.reduce((sum, s) => sum + (s.bars ?? 0), 0);

  // `valueSize`: the genre is a name, not a number, and on the page it is set at 18px against the
  // numbers' 26px. The same ratio here keeps it from being cut to "Progre…".
  const cards: { label: string; value: string; unit?: string; sub: string; valueSize?: number }[] = [
    {
      label: "Tempo",
      value: data.rhythm.bpm == null ? "—" : fmtBpm(data.rhythm.bpm),
      unit: data.rhythm.bpm == null ? undefined : "BPM",
      sub: `${data.rhythm.beatCount} beats`,
    },
    {
      label: "Key",
      value: keyLabel ? `${keyLabel.name} ${keyLabel.scale === "major" ? "maj" : "min"}` : "—",
      unit: data.tonality.camelot ?? undefined,
      sub: `${(data.tonality.strength * 100).toFixed(0)}% strength`,
    },
    {
      // Nullable, and printed as "—" when absent: the export is the copy a user sends on, so a
      // measurement we do not have must not arrive in someone's inbox as 0.0.
      label: "Loudness",
      value: data.technical.integratedLufs?.toFixed(1) ?? "—",
      unit: data.technical.integratedLufs != null ? "LUFS" : undefined,
      sub: [
        data.technical.loudnessRangeLu != null ? `LRA ${data.technical.loudnessRangeLu.toFixed(1)} LU` : null,
        data.technical.truePeakDbtp != null ? `peak ${data.technical.truePeakDbtp.toFixed(1)} dBTP` : null,
      ].filter(Boolean).join(" · ") || "range and peak unavailable",
    },
    {
      label: "Length",
      value: clock(data.identity.durationMs),
      sub: sections ? `${bars ? `${bars} bars · ` : ""}${sections} section${sections === 1 ? "" : "s"}` : "—",
    },
    {
      label: "Genre",
      valueSize: 11,
      value: topGenre.length ? shortGenre(topGenre[0].label) : "—",
      unit: topGenre.length ? `${(topGenre[0].score * 100).toFixed(0)}%` : undefined,
      sub: topGenre[1] ? `${shortGenre(topGenre[1].label)} ${(topGenre[1].score * 100).toFixed(0)}%` : "top match",
    },
  ];

  const gap = 8;
  const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const VALUE_TOP = 19;

  // Each value laid out first: a number on one line, a name wrapped onto at most two, the unit
  // after its last line. The row is then as tall as its tallest card and every card is drawn at
  // that height, as on the page, so one long genre never leaves the row ragged.
  const laid = cards.map((c) => {
    const size = c.valueSize ?? 15;
    const valueOpts = { size, bold: true, color: C.ink } as const;
    const unitW = c.unit ? widthOf(doc, c.unit, { size: 7 }) + 3 : 0;
    const room = w - 18 - unitW;
    let lines = c.valueSize ? wrap(doc, c.value, room, valueOpts) : [c.value];
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
    lines = lines.map((l) => ellipsis(doc, l, room, valueOpts));
    const lineH = size * 1.15;
    return { c, valueOpts, lines, lineH, blockH: Math.max(15, lines.length * lineH) };
  });
  const h = Math.max(50, ...laid.map((l) => VALUE_TOP + l.blockH + 3 + 13));
  L.ensure(h);

  // One size for all five second lines, the largest at which every one fits on a line. The
  // Loudness line ("LRA 5.1 LU · peak -0.7 dBTP") is the long one and was being cut to "dBT…";
  // shrinking only that card would make the row uneven, so the whole row steps down together.
  const subSize = [6.5, 6.2, 5.9, 5.6].find((size) => cards.every((c) => widthOf(doc, c.sub, { size }) <= w - 18)) ?? 5.6;
  laid.forEach(({ c, valueOpts, lines, lineH, blockH }, i) => {
    const x = MARGIN_X + i * (w + gap);
    card(doc, x, L.y, w, h);
    text(doc, c.label.toUpperCase(), x + 9, L.y + 8, { size: 6, color: C.inkMuted, spacing: 1 });
    // A 15pt number sits where it always did; a smaller name sits on the same cap line.
    const top = L.y + VALUE_TOP + (15 - valueOpts.size) * 0.35;
    lines.forEach((line, k) => text(doc, line, x + 9, top + k * lineH, valueOpts));
    if (c.unit) {
      const last = lines[lines.length - 1];
      // Shares the value's baseline: 6pt down at 15pt, as it always sat, and proportionally less for a name.
      const baseline = top + (lines.length - 1) * lineH + (valueOpts.size - 7) * 0.75;
      text(doc, c.unit, x + 9 + widthOf(doc, last, valueOpts) + 3, baseline, { size: 7, color: C.inkSoft });
    }
    const subY = L.y + VALUE_TOP + blockH + 3;
    text(doc, ellipsis(doc, c.sub, w - 18, { size: subSize }), x + 9, subY, { size: subSize, color: C.inkMuted });
  });
  L.gap(h + 18);
}

/* ------------------------------------------------------------------ timeline */

function drawTimeline(L: Layout, data: AnalysisData, plates: Plates): void {
  const { doc } = L;
  const durationMs = data.identity.durationMs;
  const segments = data.energy.structureSegments;
  const shown = segments.filter((s) => !s.hidden).length;
  const bars = segments.reduce((sum, s) => sum + (s.bars ?? 0), 0);

  const ribbons = [
    { title: "Sonic style", track: data.timeline.genreOverTime, shorten: true },
    { title: "Mood", track: data.timeline.moodOverTime, shorten: false },
    { title: "Instruments", track: data.timeline.instrumentOverTime, shorten: false },
  ].filter((r) => r.track?.series?.length);

  const stems = data.composition.stems ?? {};
  const hasStems = Object.keys(stems).length > 0;

  const sub = [shown ? `${shown} sections` : "", bars ? `${bars} bars` : "", data.rhythm.bpm != null ? `${fmtBpm(data.rhythm.bpm)} BPM` : ""]
    .filter(Boolean)
    .join(" · ");
  const summary = data.structure?.summary ?? "";
  const summaryLines = summary ? wrap(doc, summary, CONTENT_W, { size: 8.5 }) : [];
  const headH = 29 + (summaryLines.length ? summaryLines.length * 12 + 8 : 0);

  // Every lane, and what the stack costs before it is fitted to the page.
  const laneHeights = [
    LANE.ruler,
    LANE.energy,
    segments.length ? LANE.structure : 0,
    LANE.spectrum,
    LANE.pitch,
    ...ribbons.map((r) => r.track.series.length * LANE.row + (r.track.series.length - 1) * LANE.rowGap),
    hasStems ? LANE.stems : 0,
    LANE.ruler,
  ].filter((h) => h > 0);
  const stackH = laneHeights.reduce((a, b) => a + b, 0) + (laneHeights.length - 1) * LANE.gap;

  // The Timeline is the one reading that has to be seen whole, so it takes a page of its own and
  // is fitted to it rather than split. A long track with many style rows shrinks a few percent; a
  // short one grows into the room instead of leaving a third of the sheet empty. The ceiling stops
  // a beatless three-lane result from being blown up into a poster.
  const available = CONTENT_BOTTOM - CONTENT_TOP - headH - 4;
  const scale = Math.min(1.5, available / stackH);
  const h = (k: keyof typeof LANE) => LANE[k] * scale;
  const gapY = LANE.gap * scale;

  sectionHead(L, "01", "Timeline", sub);
  if (summaryLines.length) {
    summaryLines.forEach((l, i) => text(doc, l, MARGIN_X, L.y + i * 12, { size: 8.5, color: C.inkSoft }));
    L.gap(summaryLines.length * 12 + 8);
  }

  drawRuler(doc, L.y, h("ruler"), durationMs, false);
  L.gap(h("ruler") + gapY);

  // Energy leads, with the structure strip directly beneath it, as on the Timeline tab.
  laneLabel(doc, L.y, "Energy", "RMS per bar");
  laneAxis(doc, L.y, h("energy"), ["−6", "−10", "−14 dB"]);
  drawEnergy(doc, L.y, h("energy"), data, durationMs);
  L.gap(h("energy") + gapY);

  if (segments.length) {
    laneLabel(doc, L.y, "Structure", shown ? `${shown} sections` : undefined);
    drawStructure(doc, L.y, h("structure"), segments, durationMs);
    L.gap(h("structure") + gapY);
  }

  const nyquist = data.identity.sampleRateHz > 0 ? data.identity.sampleRateHz / 2 : 22050;
  const spectrum = plates.spectrum;
  laneLabel(doc, L.y, "Spectrum", "Hz, linear");
  laneAxis(doc, L.y, h("spectrum"), [1, 0.75, 0.5, 0.25, 0].map((f) => fmtHz(nyquist * f)));
  if (spectrum) image(doc, spectrum.data, CHART_X, L.y, CHART_W, h("spectrum"), "an-spectrum");
  else fillRect(doc, CHART_X, L.y, CHART_W, h("spectrum"), C.lane, 2);
  L.gap(h("spectrum") + gapY);

  // The tonic spelled for the key and placed at its own row, as on the Timeline tab. Evenly spaced
  // labels printed "B, C, C" on a C minor track, with the middle C pointing at F#.
  const tonicIndex = camelotRootPitchClass(data.tonality.camelot);
  const tonic =
    tonicIndex != null
      ? chromaLabelsForKey(data.tonality.camelot)[tonicIndex]
      : data.tonality.key
        ? data.tonality.key.replace(/\s.*$/, "")
        : null;
  const chroma = plates.chroma;
  laneLabel(doc, L.y, "Pitch", tonic ? `tonic ${tonic}` : "chromagram");
  drawPitchAxis(doc, L.y, h("pitch"), tonicIndex, tonic);
  if (chroma) image(doc, chroma.data, CHART_X, L.y, CHART_W, h("pitch"), "an-chroma");
  else fillRect(doc, CHART_X, L.y, CHART_W, h("pitch"), C.lane, 2);
  L.gap(h("pitch") + gapY);

  ribbons.forEach((r) => {
    const rows = r.track.series.length;
    const rowH = LANE.row * scale;
    const rowGap = LANE.rowGap * scale;
    const laneH = rows * rowH + (rows - 1) * rowGap;
    laneLabel(doc, L.y, r.title, "over time");
    r.track.series.forEach((s, i) => {
      const y = L.y + i * (rowH + rowGap);
      drawRibbonRow(doc, y, rowH, s.values);
      text(doc, ellipsis(doc, r.shorten ? shortGenre(s.label) : s.label, CHART_W * 0.45, { size: 6.2 }), CHART_X + 4, y + rowH / 2 - 3.2, {
        size: 6.2,
        color: C.ink,
      });
    });
    L.gap(laneH + gapY);
  });

  if (hasStems) {
    laneLabel(doc, L.y, "Stems");
    drawStemLegend(doc, L.y + 26, stems);
    drawDonut(doc, MARGIN_X + GUTTER - 11, L.y - 1, 10, stems);
    drawStems(doc, L.y, h("stems"), data, durationMs);
    L.gap(h("stems") + gapY);
  }

  drawRuler(doc, L.y, h("ruler"), durationMs, true);
  L.gap(h("ruler"));
}

/**
 * The Pitch lane's right axis. B at the top row, C at the bottom, the tonic at its own row in the
 * pitch colour. When the tonic IS B or C it is not printed twice; that end label is coloured.
 */
function drawPitchAxis(doc: jsPDF, y: number, h: number, tonicIndex: number | null, tonic: string | null): void {
  const rowTop = (pc: number) => y + (1 - (pc + 0.5) / 12) * h - 2.8;
  const clampY = (v: number) => Math.min(y + h - 5.6, Math.max(y, v));
  const mark = (label: string, pc: number, accent: boolean) =>
    text(doc, label, AXIS_X, clampY(rowTop(pc)), { size: 5.6, color: accent ? C.pitch : C.inkMuted, bold: accent });
  mark("B", 11, tonicIndex === 11);
  mark("C", 0, tonicIndex === 0);
  if (tonicIndex != null && tonicIndex !== 0 && tonicIndex !== 11 && tonic) mark(tonic, tonicIndex, true);
}

function laneLabel(doc: jsPDF, y: number, title: string, meta?: string): void {
  text(doc, title.toUpperCase(), MARGIN_X, y + 1, { size: 6.4, bold: true, color: C.inkStrong, spacing: 0.5 });
  if (meta) text(doc, ellipsis(doc, meta, GUTTER, { size: 5.8 }), MARGIN_X, y + 10, { size: 5.8, color: C.inkMuted });
}

function laneAxis(doc: jsPDF, y: number, h: number, labels: string[]): void {
  if (labels.length < 2) return;
  labels.forEach((l, i) => {
    const ly = y + (i / (labels.length - 1)) * (h - 6);
    text(doc, l, AXIS_X, ly, { size: 5.6, color: C.inkMuted });
  });
}

function drawRuler(
  doc: jsPDF,
  y: number,
  h: number,
  durationMs: number,
  flip: boolean,
  x = CHART_X,
  w = CHART_W,
): void {
  const baseY = flip ? y : y + h;
  line(doc, x, baseY, x + w, baseY, C.grid, 0.5);
  const labelY = flip ? y + 3 : y + 1;
  const tickTo = flip ? baseY + 3 : baseY - 3;

  // Both ends always, so the scale reads on a short track with no interior tick, and a mark under
  // every label so a reader can see exactly where the time falls rather than near it.
  const marks: { ms: number; align: "left" | "center" | "right" }[] = [{ ms: 0, align: "left" }];
  for (let t = 60_000; t < durationMs; t += 60_000) {
    // The track length is always printed at the right edge, so a tick that would sit under it is
    // dropped rather than stacked on top of it.
    if (t / durationMs > 0.92) break;
    marks.push({ ms: t, align: "center" });
  }
  marks.push({ ms: durationMs, align: "right" });

  marks.forEach((m) => {
    const mx = x + (durationMs > 0 ? m.ms / durationMs : 0) * w;
    line(doc, mx, baseY, mx, tickTo, C.grid, 0.5);
    text(doc, clock(m.ms), mx, labelY, { size: 5.6, color: C.inkMuted, align: m.align });
  });
}

function drawStructure(
  doc: jsPDF,
  y: number,
  h: number,
  segments: AnalysisData["energy"]["structureSegments"],
  durationMs: number,
  originX = CHART_X,
  totalW = CHART_W,
): void {
  if (durationMs <= 0) return;
  segments.forEach((s) => {
    const x = originX + (s.startMs / durationMs) * totalW;
    const w = ((s.endMs - s.startMs) / durationMs) * totalW - 1;
    if (w <= 0 || s.hidden) return;
    const tone = sectionTone(sectionWord(s));
    fillRect(doc, x, y, w, h, tone.bg, 2);
    fillRect(doc, x, y, w, 1.6, tone.fg);
    // The handoff's rule for a narrow block: the full name when it fits, else three letters and
    // the number ("GRO 1"), else nothing. The name always wins over the bar count, which is the
    // order the strip on screen hides them in; a block reading only "16 bars" says nothing.
    const labelOpts = { size: 6.4, bold: true, color: tone.fg, spacing: 0.3 } as const;
    const full = (s.label || "").toUpperCase();
    const short = s.label ? abbreviateSectionLabel(s.label) : "";
    const label = [full, short].find((t) => t && widthOf(doc, t, labelOpts) < w - 6) ?? "";
    if (label) text(doc, label, x + w / 2, y + h / 2 - 7, { ...labelOpts, align: "center" });
    if (s.bars && label) {
      const barsText = `${s.bars} ${s.bars === 1 ? "bar" : "bars"}`;
      const barsOpts = { size: 5.8, color: tone.fg } as const;
      if (widthOf(doc, barsText, barsOpts) < w - 6) {
        text(doc, barsText, x + w / 2, y + h / 2 + 1, { ...barsOpts, align: "center" });
      }
    }
  });
}

function drawEnergy(
  doc: jsPDF,
  y: number,
  h: number,
  data: AnalysisData,
  durationMs: number,
  originX = CHART_X,
  totalW = CHART_W,
): void {
  fillRect(doc, originX, y, totalW, h, C.lane, 2);
  [0.33, 0.66].forEach((f) => line(doc, originX, y + f * h, originX + totalW, y + f * h, C.grid, 0.4, [1.5, 2]));

  const bars = barsFromDownbeats(data.rhythm.downbeatsSeconds, durationMs);
  if (!bars.length || durationMs <= 0) return;
  const values = barMeans(data.technical.rmsEnergyCurve, bars);
  const segments = data.energy.structureSegments;

  bars.forEach((b, i) => {
    const x = originX + (b.startMs / durationMs) * totalW;
    // Bars meet rather than leaving a hairline of lane between them: at two points wide, a gap
    // reads as a white grid drawn over the energy instead of as separate bars.
    const w = Math.max(0.35, ((b.endMs - b.startMs) / durationMs) * totalW);
    const bh = Math.max(0.6, (values[i] ?? 0) * h);
    const section = sectionAtMs(segments, (b.startMs + b.endMs) / 2);
    const tone = section ? sectionTone(sectionWord(section)).fg : blend(C.inkMuted, C.lane, 0.5);
    fillRect(doc, x, y + h - bh, w, bh, tone);
  });

  const curve = data.technical.loudnessCurve;
  if (curve?.values?.length) {
    const pts: Point[] = [];
    bars.forEach((b) => {
      const db = meanInRange(curve, b.startMs, b.endMs);
      if (db == null || !Number.isFinite(db)) return;
      pts.push({
        x: originX + (((b.startMs + b.endMs) / 2) / durationMs) * totalW,
        y: y + lufsFrac(db) * h,
      });
    });
    polyline(doc, pts, C.ink, 0.6);
  }
}

/**
 * One heat row, as runs of solid colour.
 *
 * The row on screen is a one-pixel canvas of the accent at each frame's alpha. Here the alpha is
 * flattened against the lane and equal neighbours are merged, which turns a few hundred cells into
 * a few dozen rectangles without changing what it looks like.
 */
function drawRibbonRow(doc: jsPDF, y: number, h: number, values: number[]): void {
  fillRect(doc, CHART_X, y, CHART_W, h, C.lane, 1.5);
  const n = values.length;
  if (!n) return;
  const STEPS = 24;
  const level = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * STEPS);
  let runStart = 0;
  let runLevel = level(values[0]);
  const flush = (end: number) => {
    if (runLevel > 0) {
      const x = CHART_X + (runStart / n) * CHART_W;
      const w = ((end - runStart) / n) * CHART_W;
      fillRect(doc, x, y, w, h, blend(C.accent, C.lane, runLevel / STEPS));
    }
  };
  for (let i = 1; i < n; i++) {
    const l = level(values[i]);
    if (l !== runLevel) {
      flush(i);
      runStart = i;
      runLevel = l;
    }
  }
  flush(n);
}

function drawStems(doc: jsPDF, y: number, h: number, data: AnalysisData, durationMs: number): void {
  const stems = data.composition.stems;
  const names = Object.keys(stems);
  fillRect(doc, CHART_X, y, CHART_W, h, C.lane, 2);
  const n = names.length ? stems[names[0]].energyCurve.values.length : 0;
  if (!n) return;

  if (durationMs > 0) {
    (data.composition.vocalRegions ?? []).forEach((r) => {
      const x = CHART_X + (r.startMs / durationMs) * CHART_W;
      const w = Math.max(0, ((r.endMs - r.startMs) / durationMs) * CHART_W);
      fillRect(doc, x, y, w, h, blend(STEM_RGB.vocals, C.lane, 0.12));
    });
  }

  const totals = Array.from({ length: n }, (_, i) =>
    names.reduce((s, name) => s + (stems[name].energyCurve.values[i] ?? 0), 0),
  );
  const maxSum = Math.max(...totals, 0.0001);

  // The curves are sampled down to what the page can resolve: a 441pt lane cannot show more than
  // a few hundred turns, and a polygon per stem stays small in the file.
  const STEPS = Math.min(n, 320);
  const at = (i: number) => Math.min(n - 1, Math.round((i * (n - 1)) / (STEPS - 1)));
  const xOf = (i: number) => CHART_X + (i / (STEPS - 1)) * CHART_W;

  let lower = new Array(STEPS).fill(0);
  names.forEach((name) => {
    const vals = stems[name].energyCurve.values;
    const upper = lower.map((l, i) => l + (vals[at(i)] ?? 0));
    const top: Point[] = upper.map((v, i) => ({ x: xOf(i), y: y + h - (v / maxSum) * h }));
    const bottom: Point[] = lower.map((v, i) => ({ x: xOf(i), y: y + h - (v / maxSum) * h })).reverse();
    polygon(doc, [...top, ...bottom], blend(STEM_RGB[name] ?? [136, 136, 136], C.lane, 0.8));
    lower = upper;
  });
}

function drawStemLegend(doc: jsPDF, y: number, stems: AnalysisData["composition"]["stems"]): void {
  Object.keys(stems).forEach((name, i) => {
    const ly = y + i * 9;
    const color = STEM_RGB[name] ?? [136, 136, 136];
    fillRect(doc, MARGIN_X, ly, GUTTER, 7.5, blend(color, C.page, 0.16), 1.5);
    text(doc, `${name} ${stems[name].presencePct.toFixed(0)}%`, MARGIN_X + 3, ly + 1.4, { size: 5.4, color });
  });
}

function drawDonut(doc: jsPDF, cx: number, cy: number, r: number, stems: AnalysisData["composition"]["stems"]): void {
  const names = Object.keys(stems);
  const total = names.reduce((s, n) => s + stems[n].presencePct, 0) || 1;
  let a = -Math.PI / 2;
  names.forEach((name) => {
    const sweep = (stems[name].presencePct / total) * Math.PI * 2;
    annulusSegment(doc, cx, cy + r, r * 0.58, r, a, a + sweep, blend(STEM_RGB[name] ?? [136, 136, 136], C.page, 0.9), 8);
    a += sweep;
  });
}

/* ------------------------------------------------------------------- harmony */

function drawHarmony(L: Layout, data: AnalysisData): void {
  const { doc } = L;
  const { tonality } = data;
  const keyLabel = keyFromCamelot(tonality.camelot);
  const altLabel = keyFromCamelot(tonality.altCamelot);
  const neighbours = camelotNeighbours(tonality.camelot);

  // Key, then the Alternative only when the key is genuinely in doubt, then the tonic, as on the
  // Harmony tab. The cross-check always finds a best-fitting neighbour and it is usually the
  // parallel key, so printing it beside a confident reading invented a doubt the analysis does not
  // have (Smile Funk: C minor at 84%, "alternative" C major).
  const showAlternative = !!tonality.ambiguous && !!altLabel;
  const tonicIndex = camelotRootPitchClass(tonality.camelot);
  const chromaAll =
    tonality.meanChroma?.length === 12 ? tonality.meanChroma : meanChromaFromMatrix(tonality.chromagram?.data);
  const chromaSum = chromaAll.reduce((a, b) => a + b, 0);
  const tonicShare =
    chromaSum > 0 && tonicIndex != null && chromaAll.length === 12 ? Math.round((chromaAll[tonicIndex] / chromaSum) * 100) : null;

  const wheelSize = 176;
  const noticeH = tonality.ambiguous ? 28 : 0;
  L.ensure(26 + wheelSize + noticeH + 10);
  sectionHead(L, "02", "Harmony", tonality.camelot ?? undefined);

  const top = L.y;
  drawWheel(doc, MARGIN_X + wheelSize / 2, top + wheelSize / 2, wheelSize / 2, tonality.camelot ?? "");

  const rx = MARGIN_X + wheelSize + 24;
  const rw = CONTENT_W - wheelSize - 24;
  let cy = top;
  keyCard(doc, rx, cy, rw, "Key", keyLabel ? `${keyLabel.name} ${keyLabel.scale}` : "—",
    tonality.camelot ? `${tonality.camelot} Camelot · ${(tonality.strength * 100).toFixed(0)}% strength` : "not read");
  cy += 54;
  if (showAlternative && altLabel) {
    keyCard(doc, rx, cy, rw, "Alternative", `${altLabel.name} ${altLabel.scale}`,
      tonality.altCamelot ? `${tonality.altCamelot} Camelot · runner-up` : "runner-up");
    cy += 54;
  }
  keyCard(doc, rx, cy, rw, "Tonic", tonicIndex != null ? chromaLabelsForKey(tonality.camelot)[tonicIndex] : "—",
    tonicShare == null ? "—" : `${tonicShare}% of pitch energy`, C.pitch);
  L.gap(wheelSize + 12);

  if (tonality.ambiguous) {
    fillRect(doc, MARGIN_X, L.y, CONTENT_W, 20, C.flagBg, 3);
    text(
      doc,
      `Key may be ambiguous${altLabel ? `, possibly ${altLabel.name} ${altLabel.scale} (${tonality.altCamelot})` : ""}`,
      MARGIN_X + 10,
      L.y + 6,
      { size: 7.5, color: C.flagFg },
    );
    L.gap(noticeH);
  }
  L.gap(6);

  if (neighbours.length) {
    L.ensure(56);
    minorHead(L, "Mix-compatible keys");
    const gap = 8;
    const w = (CONTENT_W - gap * 3) / 4;
    neighbours.forEach((n, i) => {
      const x = MARGIN_X + i * (w + gap);
      card(doc, x, L.y, w, 38, C.lane);
      const label = keyFromCamelot(n.code);
      text(doc, n.code, x + 8, L.y + 7, { size: 13, bold: true, color: C.ink });
      text(doc, label ? `${label.name} ${label.scale}` : "—", x + w - 8, L.y + 11, { size: 7, color: C.inkSoft, align: "right" });
      text(doc, ellipsis(doc, n.relation, w - 16, { size: 6.4 }), x + 8, L.y + 25, { size: 6.4, color: C.inkMuted });
    });
    L.gap(38 + 18);
  }

  const chroma =
    tonality.meanChroma?.length === 12 ? tonality.meanChroma : meanChromaFromMatrix(tonality.chromagram?.data);
  if (chroma.length === 12) {
    const barsH = 70;
    L.ensure(20 + barsH + 12);
    minorHead(L, "Note energy", "whole track · in-key notes lit, others dimmed");
    const names = chromaLabelsForKey(tonality.camelot);
    const inKey = inKeyPitchClasses(tonality.camelot);
    const tonicIndex = camelotRootPitchClass(tonality.camelot) ?? -1;
    const max = chroma.reduce((m, v) => (v > m ? v : m), 0) || 1;
    const gap = 6;
    const w = (CONTENT_W - gap * 11) / 12;
    names.forEach((note, i) => {
      const x = MARGIN_X + i * (w + gap);
      const alpha = !inKey.size ? 0.7 : i === tonicIndex ? 1 : inKey.has(i) ? 0.55 : 0.15;
      const bh = Math.max(1.5, (chroma[i] / max) * barsH);
      fillRect(doc, x, L.y + barsH - bh, w, bh, blend(C.pitch, C.page, alpha), 1.5);
      text(doc, note, x + w / 2, L.y + barsH + 4, {
        size: 6.8,
        align: "center",
        bold: i === tonicIndex,
        color: i === tonicIndex ? C.pitch : inKey.has(i) || !inKey.size ? C.inkSoft : C.inkFaint,
      });
    });
    L.gap(barsH + 26);
  }
}

function keyCard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, sub: string, valueColor: RGB = C.ink): void {
  card(doc, x, y, w, 46);
  text(doc, label.toUpperCase(), x + 10, y + 8, { size: 6.2, color: C.inkMuted, spacing: 1 });
  text(doc, ellipsis(doc, value, w - 20, { size: 16, bold: true }), x + 10, y + 18, { size: 16, bold: true, color: valueColor });
  text(doc, ellipsis(doc, sub, w - 20, { size: 7 }), x + 10, y + 35, { size: 7, color: C.inkMuted });
}

/**
 * The Camelot wheel, as twenty-four ring segments.
 *
 * Same geometry as the one on screen: majors on the outer ring, minors inside, the track's key
 * filled in the accent and the three keys it mixes with at a third of it.
 */
function drawWheel(doc: jsPDF, cx: number, cy: number, r: number, camelot: string): void {
  const num = parseInt(camelot, 10);
  const side = camelot.slice(-1).toUpperCase();
  const neighbourOf = (i: number, s: "A" | "B") =>
    (s === side && (i + 1 === (num % 12) + 1 || i + 1 === ((num + 10) % 12) + 1)) || (i + 1 === num && s !== side);

  const rings: { s: "A" | "B"; inner: number; outer: number; label: number; size: number }[] = [
    { s: "B", inner: r * 0.62, outer: r, label: r * 0.81, size: 5.6 },
    { s: "A", inner: r * 0.3, outer: r * 0.62, label: r * 0.46, size: 5.2 },
  ];

  rings.forEach((ring) => {
    for (let i = 0; i < 12; i++) {
      const a0 = (Math.PI * 2 * (i - 0.5)) / 12 - Math.PI / 2;
      const a1 = (Math.PI * 2 * (i + 0.5)) / 12 - Math.PI / 2;
      const active = i + 1 === num && side === ring.s;
      const near = neighbourOf(i, ring.s);
      const fill = active ? C.accent : near ? blend(C.accent, C.page, 0.28) : blend(C.ink, C.page, 0.05);
      // The cells are nearly black, so the wheel is drawn by its edges, exactly as it is on
      // screen. Filled flat without them it reads as a grey disc with three coloured bites.
      annulusSegment(doc, cx, cy, ring.inner, ring.outer, a0, a1, fill, 8, blend(C.ink, C.page, 0.18));

      const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
      const lx = cx + Math.cos(a) * ring.label;
      const ly = cy + Math.sin(a) * ring.label - ring.size / 2;
      text(doc, `${i + 1}${ring.s}`, lx, ly, {
        size: ring.size,
        align: "center",
        color: active ? C.page : blend(C.ink, C.page, 0.8),
        bold: active,
      });
    }
  });

  if (camelot) text(doc, camelot, cx, cy - 6, { size: 12, bold: true, align: "center", color: C.ink });
}

/* ---------------------------------------------------------------------- vibe */

/** Same six as the Vibe tab, second line included: a score with no axis printed cannot be read. */
const METERS: {
  label: string;
  sub: string;
  pick: (s: AnalysisData["semantics"]) => number;
  key: keyof typeof METER_RGB;
}[] = [
  { label: "Danceable", sub: "rhythm regularity", pick: (s) => s.danceability, key: "danceable" },
  { label: "Electronic", sub: "vs acoustic", pick: (s) => s.moodElectronic, key: "electronic" },
  { label: "Vocal", sub: "voice presence", pick: (s) => s.voiceScore, key: "vocal" },
  { label: "Approachable", sub: "vs experimental", pick: (s) => s.approachability, key: "approachable" },
  { label: "Bright", sub: "vs dark", pick: (s) => s.timbreBright, key: "bright" },
  { label: "Acoustic", sub: "instrumentation", pick: (s) => s.moodAcoustic, key: "acoustic" },
];

function drawVibe(L: Layout, data: AnalysisData): void {
  const { doc } = L;
  const s = data.semantics;
  const plot = 168;
  L.ensure(26 + plot + 10);
  sectionHead(
    L,
    "03",
    "Vibe",
    `${s.valence >= 0 ? "+" : ""}${s.valence.toFixed(2)} valence · ${s.arousal >= 0 ? "+" : ""}${s.arousal.toFixed(2)} arousal`,
  );

  const top = L.y;
  fillRect(doc, MARGIN_X, top, plot, plot, C.lane, 4);
  strokeRect(doc, MARGIN_X, top, plot, plot, C.line, 4);
  line(doc, MARGIN_X + 8, top + plot / 2, MARGIN_X + plot - 8, top + plot / 2, C.grid, 0.5);
  line(doc, MARGIN_X + plot / 2, top + 8, MARGIN_X + plot / 2, top + plot - 8, C.grid, 0.5);
  text(doc, "ENERGETIC", MARGIN_X + plot / 2, top + 6, { size: 5.4, color: C.inkSoft, align: "center", spacing: 0.6 });
  text(doc, "CALM", MARGIN_X + plot / 2, top + plot - 12, { size: 5.4, color: C.inkSoft, align: "center", spacing: 0.6 });
  text(doc, "DARK", MARGIN_X + 7, top + plot / 2 - 3, { size: 5.4, color: C.inkSoft, spacing: 0.6 });
  text(doc, "BRIGHT", MARGIN_X + plot - 7, top + plot / 2 - 3, { size: 5.4, color: C.inkSoft, align: "right", spacing: 0.6 });

  const px = MARGIN_X + ((s.valence + 1) / 2) * plot;
  const py = top + plot - ((s.arousal + 1) / 2) * plot;
  fillRect(doc, px - 7, py - 7, 14, 14, blend(C.accent, C.lane, 0.16), 7);
  fillRect(doc, px - 3.2, py - 3.2, 6.4, 6.4, C.accent, 3.2);

  const rx = MARGIN_X + plot + 24;
  const rw = CONTENT_W - plot - 24;
  text(doc, "PERCEPTUAL PROFILE", rx, top, { size: 6.4, bold: true, color: C.inkStrong, spacing: 1.2 });
  const colW = (rw - 18) / 2;
  METERS.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = rx + col * (colW + 18);
    const y = top + 16 + row * 34;
    const v = Math.max(0, Math.min(1, m.pick(s)));
    text(doc, m.label, x, y, { size: 8, color: C.ink });
    text(doc, String(Math.round(v * 100)), x + colW, y, { size: 8, color: C.ink, align: "right" });
    text(doc, m.sub, x, y + 10, { size: 6.2, color: C.inkMuted });
    fillRect(doc, x, y + 20, colW, 3.6, C.line, 1.8);
    fillRect(doc, x, y + 20, colW * v, 3.6, METER_RGB[m.key], 1.8);
    line(doc, x, y + 29, x + colW, y + 29, C.rule, 0.4);
  });
  L.gap(plot + 18);

  const tags = [...(s.moodThemeTop ?? [])].sort((a, b) => b.score - a.score);
  if (!tags.length) return;
  const shownTags = tags.slice(0, 6);
  const hidden = tags.slice(6);

  // Head, one row of pills and the line naming the rest. A second row is rare and the page has
  // room for it; asking for two up front pushed the whole block onto the next sheet.
  L.ensure(14 + 34 + 12);
  minorHead(L, "Mood tags", "top three highlighted");
  let x = MARGIN_X;
  let rowTop = L.y;
  let rowH = 0;
  shownTags.forEach((t, i) => {
    // The top three, always, as on the Vibe tab. Mood scores rarely pass 30%, so a 50% line lit
    // nothing and the legend promised a highlight the page never drew.
    const hot = i < 3;
    const size = 8 + Math.round(Math.min(1, Math.max(0, t.score)) * 3);
    const label = t.label.toLowerCase();
    const pct = `${Math.round(t.score * 100)}%`;
    const w = widthOf(doc, label, { size }) + widthOf(doc, pct, { size: 6.4 }) + (hot ? 30 : 24);
    const h = size + (hot ? 14 : 10);
    if (x + w > MARGIN_X + CONTENT_W) {
      x = MARGIN_X;
      rowTop += rowH + 6;
      rowH = 0;
    }
    fillRect(doc, x, rowTop, w, h, hot ? C.tagHotBg : C.tagBg, 3);
    strokeRect(doc, x, rowTop, w, h, hot ? blend(C.tagHotFg, C.tagHotBg, 0.33) : C.tagEdge, 3, 0.4);
    text(doc, label, x + (hot ? 10 : 8), rowTop + (hot ? 6 : 4), { size, color: hot ? C.tagHotFg : C.tagFg });
    text(doc, pct, x + w - (hot ? 10 : 8), rowTop + (hot ? 9 : 6.5), {
      size: 6.4,
      align: "right",
      color: hot ? C.tagHotFg : C.inkMuted,
    });
    x += w + 6;
    rowH = Math.max(rowH, h);
  });
  L.y = rowTop + rowH + 8;

  if (hidden.length) {
    const label = `hidden: ${hidden.map((t) => `${t.label}\u00a0${Math.round(t.score * 100)}`).join(" · ")}`;
    L.gap(paragraph(doc, label, MARGIN_X, L.y, CONTENT_W, { size: 6.4, color: C.inkFaint, leading: 9 }));
  }
  L.gap(18);
}

/* --------------------------------------------------------------------- genre */

const TOP_N = 10;

function drawGenre(L: Layout, data: AnalysisData): void {
  const { doc } = L;
  const genre = (data.semantics.styleMaestTop ?? []).slice(0, TOP_N);
  const style = (data.semantics.genreTop ?? []).slice(0, TOP_N);
  const shown = Math.max(genre.length, style.length, 1);
  L.ensure(26 + 22 + shown * 22 + 30);
  sectionHead(L, "04", "Genre & Sonic Style", `top ${shown} of each`);

  const gap = 20;
  const w = (CONTENT_W - gap) / 2;
  [
    { title: "Genre", items: genre, x: MARGIN_X },
    { title: "Sonic style", items: style, x: MARGIN_X + w + gap },
  ].forEach(({ title, items, x }) => {
    const h = 22 + Math.max(1, items.length) * 22 + 8;
    card(doc, x, L.y, w, h);
    text(doc, title.toUpperCase(), x + 12, L.y + 10, { size: 6.6, bold: true, color: C.inkStrong, spacing: 1.2 });
    if (!items.length) {
      text(doc, "not available for this track", x + 12, L.y + 26, { size: 8, color: C.inkMuted });
      return;
    }
    items.forEach((it, i) => {
      const y = L.y + 26 + i * 22;
      const label = ellipsis(doc, shortGenre(it.label), w - 24 - 26, { size: 8 });
      text(doc, label, x + 12, y, { size: 8, color: C.ink });
      text(doc, `${(it.score * 100).toFixed(0)}%`, x + w - 12, y, { size: 7.4, color: C.inkSoft, align: "right" });
      fillRect(doc, x + 12, y + 11, w - 24, 3.4, blend(C.ink, C.card, 0.18), 1.7);
      fillRect(doc, x + 12, y + 11, (w - 24) * Math.max(0.02, Math.min(1, it.score)), 3.4, C.accent, 1.7);
    });
  });
  L.gap(22 + shown * 22 + 8 + 12);

  L.gap(
    paragraph(
      doc,
      "Two readings of the same track. Where they agree, the label is safe to file under.",
      MARGIN_X,
      L.y,
      CONTENT_W,
      { size: 8, color: C.inkSoft, leading: 12 },
    ),
  );
  L.gap(14);
}

/* ------------------------------------------------------------------ readings */

const READINGS: { key: keyof AnalysisData["readings"]; title: string }[] = [
  { key: "forDj", title: "For a DJ" },
  { key: "forProducers", title: "For a producer" },
  { key: "forCurators", title: "For a curator" },
];

function hasReadings(data: AnalysisData): boolean {
  return READINGS.some(({ key }) => (data.readings?.[key] ?? "").trim().length > 0);
}

/**
 * The written readings, where the result carries them.
 *
 * On screen these are a footnote nobody scrolls to. On paper they are the part a reader who is not
 * looking at a spectrogram will actually read, so they close the document.
 */
function drawReadings(L: Layout, data: AnalysisData): void {
  const { doc } = L;
  const present = READINGS.map((r) => ({ ...r, body: (data.readings?.[r.key] ?? "").trim() })).filter((r) => r.body);
  if (!present.length) return;

  const gap = 16;
  const w = (CONTENT_W - gap * (present.length - 1)) / present.length;
  const bodyOpts = { size: 8, color: C.inkSoft } as const;
  const blocks = present.map((r) => ({ ...r, lines: wrap(doc, r.body, w - 24, bodyOpts) }));
  const tallest = Math.max(...blocks.map((b) => b.lines.length));
  const h = 30 + tallest * 12 + 14;

  L.ensure(26 + h);
  sectionHead(L, "05", "In words", "how the track reads");
  blocks.forEach((b, i) => {
    const x = MARGIN_X + i * (w + gap);
    card(doc, x, L.y, w, h);
    text(doc, b.title.toUpperCase(), x + 12, L.y + 11, { size: 6.6, bold: true, color: C.inkStrong, spacing: 1.2 });
    b.lines.forEach((l, k) => text(doc, l, x + 12, L.y + 28 + k * 12, bodyOpts));
  });
  L.gap(h + 16);
}

const CLOSING =
  "Tempo, key and loudness are measured from the audio. Genre, mood, style and instruments are " +
  "predicted, and read best as a ranking rather than a single answer. Structure is read from the " +
  "beat grid, so a track with no steady pulse is described in looser words than one with a clear one.";

function drawClosing(L: Layout): void {
  const opts = { size: 7.6, color: C.inkMuted, leading: 12 } as const;
  const lines = wrap(L.doc, CLOSING, CONTENT_W, opts);
  L.ensure(10 + lines.length * 12);
  line(L.doc, MARGIN_X, L.y, MARGIN_X + CONTENT_W, L.y, C.line, 0.5);
  L.gap(10);
  L.gap(paragraph(L.doc, CLOSING, MARGIN_X, L.y, CONTENT_W, opts));
}

/* ----------------------------------------------------------------- furniture */

function sectionHead(L: Layout, index: string, title: string, sub?: string): void {
  const { doc } = L;
  text(doc, index, MARGIN_X, L.y + 3, { size: 7, color: C.accent, spacing: 1 });
  text(doc, title.toUpperCase(), MARGIN_X + 20, L.y, { size: 12, bold: true, color: C.ink, spacing: 0.4 });
  if (sub) text(doc, sub, MARGIN_X + CONTENT_W, L.y + 4, { size: 7, color: C.inkMuted, align: "right" });
  L.gap(17);
  line(doc, MARGIN_X, L.y, MARGIN_X + CONTENT_W, L.y, C.line, 0.5);
  L.gap(12);
}

function minorHead(L: Layout, title: string, aside?: string): void {
  text(L.doc, title.toUpperCase(), MARGIN_X, L.y, { size: 6.6, bold: true, color: C.inkStrong, spacing: 1.2 });
  if (aside) text(L.doc, aside, MARGIN_X + CONTENT_W, L.y, { size: 6.2, color: C.inkMuted, align: "right" });
  L.gap(14);
}

/**
 * The frame every page carries: the site's dotted side lines, and a footer naming the track, the
 * platform and the page. Drawn last, because the page count is only known once the document is.
 */
function drawFurniture(doc: jsPDF, title: string): void {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    line(doc, MARGIN_X, 0, MARGIN_X, PAGE_H, C.line, 0.5, [0.8, 2.4]);
    line(doc, PAGE_W - MARGIN_X, 0, PAGE_W - MARGIN_X, PAGE_H, C.line, 0.5, [0.8, 2.4]);

    const fy = PAGE_H - FOOTER_H;
    line(doc, MARGIN_X, fy, PAGE_W - MARGIN_X, fy, C.rule, 0.5);
    text(doc, ellipsis(doc, title, 200, { size: 6.4 }), MARGIN_X, fy + 10, { size: 6.4, color: C.inkFaint });
    text(doc, "RESOMIX · RESOMIX.COM", PAGE_W / 2, fy + 10, { size: 6.4, color: C.inkMuted, align: "center", spacing: 1.4 });
    text(doc, `${p} / ${total}`, PAGE_W - MARGIN_X, fy + 10, { size: 6.4, color: C.inkFaint, align: "right" });
  }
}
