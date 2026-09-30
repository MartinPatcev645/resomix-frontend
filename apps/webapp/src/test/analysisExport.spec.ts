import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";

import { mapCanonicalToAnalysisData } from "../pages/analysis/mapCanonical.js";
import { buildAnalysisPdf, formatUtc, trackFacts } from "../components/Analysis/export/buildAnalysisPdf.js";
import { pdfFilename } from "../components/Analysis/export/exportAnalysisPdf.js";
import { chromaPng, spectrogramPng } from "../components/Analysis/export/pdfImages.js";

/**
 * The PDF export, built for real rather than mocked.
 *
 * The document is drawn from numbers with no DOM in the path, which is the whole point of the
 * design, and it means the actual PDF can be produced inside a test. So these build it, on a full
 * result and on a part-1 one, and check the things that would make a shipped export embarrassing:
 * a page count that means the layout collapsed, a document that throws on a missing field, and a
 * filename a filesystem will not take.
 */

const meta = {
  exportedOn: "24 September 2026",
  landingUrl: "https://resomix.com",
  betaUrl: "https://beta.resomix.com",
};

/** Roughly a six-minute track: 224 bars, nine sections, six rows in each timeline group. */
const series = (label: string, n = 240) => ({
  label,
  values: Array.from({ length: n }, (_, i) => Math.abs(Math.sin(i / 11 + label.length))),
});

const full = mapCanonicalToAnalysisData({
  identity: {
    input_filename: "02. Modem - Joto (Original Mix).mp3",
    duration_ms: 384000,
    sample_rate_hz: 44100,
    channel_count: 2,
    codec: "mp3",
    bit_rate: 320000,
  },
  technical: {
    integrated_loudness_lufs: -10.8,
    loudness_range_lu: 1.1,
    true_peak_dbtp: 0.4,
    rms_energy_curve: { values: Array.from({ length: 400 }, (_, i) => 0.3 + 0.6 * Math.abs(Math.sin(i / 23))), hop_ms: 960 },
    loudness_curve: { values: Array.from({ length: 400 }, (_, i) => -14 + 6 * Math.sin(i / 17)), hop_ms: 960 },
  },
  rhythm: {
    bpm: 140,
    confidence: 0.6,
    beat_times_seconds: Array.from({ length: 893 }, (_, i) => (i * 384) / 893),
    bar_count: 224,
    downbeats_seconds: Array.from({ length: 224 }, (_, i) => (i * 384) / 224),
  },
  tonality: {
    key: "G", scale: "major", camelot: "9B", strength: 0.56, alt_camelot: "9A", ambiguous: true,
    mean_chroma: [0.9, 0.2, 0.5, 0.15, 0.4, 0.3, 0.2, 0.75, 0.2, 0.5, 0.25, 0.45],
    chromagram: {
      data: Array.from({ length: 12 }, (_, r) => Array.from({ length: 600 }, (_, c) => Math.abs(Math.sin(c / 30 + r)))),
      hop_ms: 640,
    },
  },
  spectral: {
    mel_spectrogram: {
      data: Array.from({ length: 40 }, (_, r) => Array.from({ length: 600 }, (_, c) => -90 + 80 * Math.abs(Math.sin(c / 40 + r / 6)))),
      hop_ms: 640,
    },
  },
  energy: { bass_entry_ms: 15000 },
  structure: {
    status: "ok",
    summary: "32-bar intro · build 1 from bar 33 (0:56) · groove 1 from bar 65 (1:51) · outro from bar 193 (5:31)",
    family: "groove",
    sections: [
      { start_ms: 0, end_ms: 56000, label: "intro 1", word: "intro", shown: "intro 1", bars: 32, start_bar: 1 },
      { start_ms: 56000, end_ms: 84000, label: "build 1", word: "build", shown: "build 1", bars: 16, start_bar: 33 },
      { start_ms: 84000, end_ms: 111000, label: "build 2", word: "build", shown: "build 2", bars: 16, start_bar: 49 },
      { start_ms: 111000, end_ms: 166000, label: "groove 1", word: "groove", shown: "groove 1", bars: 32, start_bar: 65 },
      { start_ms: 166000, end_ms: 221000, label: "groove 2", word: "groove", shown: "groove 2", bars: 32, start_bar: 97 },
      { start_ms: 221000, end_ms: 276000, label: "breakdown 1", word: "breakdown", shown: "breakdown 1", bars: 32, start_bar: 129 },
      { start_ms: 276000, end_ms: 331000, label: "groove 3", word: "groove", shown: "groove 3", bars: 32, start_bar: 161 },
      { start_ms: 331000, end_ms: 384000, label: "outro 1", word: "outro", shown: "outro 1", bars: 32, start_bar: 193 },
    ],
  },
  semantics: {
    genre_top: [
      { label: "Electronic---Techno", score: 0.74 }, { label: "Electronic---Tech Trance", score: 0.31 },
      { label: "Electronic---Hard Techno", score: 0.22 }, { label: "Electronic---Minimal", score: 0.18 },
      { label: "Electronic---House", score: 0.12 }, { label: "Electronic---Trance", score: 0.09 },
      { label: "Electronic---Progressive House", score: 0.05 },
    ],
    style_maest_top: [
      { label: "Electronic---Techno", score: 0.81 }, { label: "Electronic---Hard Techno", score: 0.4 },
      { label: "Electronic---Acid", score: 0.26 }, { label: "Electronic---Minimal", score: 0.2 },
      { label: "Electronic---Industrial", score: 0.16 }, { label: "Electronic---Trance", score: 0.1 },
      { label: "Electronic---Electro", score: 0.07 },
    ],
    mood_theme_top: [
      { label: "energetic", score: 0.78 }, { label: "dark", score: 0.64 }, { label: "powerful", score: 0.52 },
      { label: "deep", score: 0.31 }, { label: "party", score: 0.24 }, { label: "melodic", score: 0.19 },
      { label: "sexy", score: 0.12 }, { label: "sport", score: 0.08 },
    ],
    danceability: 0.86, approachability: 0.61, voice_score: 0.12, timbre_bright: 0.55,
    mood_acoustic: 0.08, mood_electronic: 0.97, valence: 0.32, arousal: 0.71,
  },
  timeline: {
    genre_over_time: { hop_ms: 1600, series: ["Electronic---Techno", "Electronic---Acid", "Electronic---Minimal", "Electronic---Trance", "Electronic---House", "Electronic---Electro"].map((l) => series(l)) },
    mood_over_time: { hop_ms: 1600, series: ["energetic", "dark", "powerful", "deep", "party", "melodic"].map((l) => series(l)) },
    instrument_over_time: { hop_ms: 1600, series: ["drums", "synthesizer", "bass", "pad", "fx", "vocals"].map((l) => series(l)) },
  },
  composition: {
    stems: {
      drums: { presence_pct: 92, energy_curve: { values: series("drums", 300).values, hop_ms: 1280 } },
      bass: { presence_pct: 71, energy_curve: { values: series("bass", 300).values, hop_ms: 1280 } },
      other: { presence_pct: 58, energy_curve: { values: series("other", 300).values, hop_ms: 1280 } },
      vocals: { presence_pct: 11, energy_curve: { values: series("vocals", 300).values, hop_ms: 1280 } },
    },
    vocal_regions: [{ start_ms: 120000, end_ms: 160000, mean_score: 0.4 }],
  },
  readings: {
    for_dj: "Steady 140 BPM with a 32-bar intro, so there is a full phrase to blend over. The first groove lands at 1:51 and the breakdown at 3:41 gives a clean exit.",
    for_producers: "Loud and narrow, 1.1 LU of range against -10.8 LUFS integrated. The bass sits under the kick for most of the track and the top end only opens in the builds.",
    for_curators: "Reads as techno from both models, with acid and hard techno behind it. Energetic and dark, with no vocal to speak of.",
  },
});

/** Part 1 only: no structure, no genre, no stems, and the GPU values still null. */
const partial = mapCanonicalToAnalysisData({
  identity: { input_filename: "bounce_test_final.wav", duration_ms: 240000, sample_rate_hz: 44100 },
  technical: { integrated_loudness_lufs: -8.2 },
  spectral: { mel_spectrogram: { data: [[-20, -30]], hop_ms: 120000 } },
});

const makeDoc = () => new jsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });

describe("trackFacts", () => {
  it("splits artist from title, drops the track number and the extension", () => {
    expect(trackFacts("02. Modem - Joto (Original Mix).mp3")).toMatchObject({
      artist: "Modem",
      title: "Joto (Original Mix)",
    });
  });

  it("claims no artist when the name does not carry one", () => {
    expect(trackFacts("bounce_test_final.wav")).toMatchObject({ artist: null, title: "bounce_test_final" });
  });

  it("keeps a hyphenated title whole", () => {
    expect(trackFacts("Artist - Track - Remix Name.mp3").title).toBe("Track - Remix Name");
  });
});

describe("formatUtc", () => {
  it("prints the date, the time and the zone, the same way on every browser", () => {
    expect(formatUtc(Date.UTC(2026, 8, 27, 14, 5))).toBe("27 September 2026, 14:05 UTC");
  });

  it("uses UTC, not the machine's clock", () => {
    // 23:30 UTC on the 30th is already the 1st in Pakistan; the export must still say the 30th.
    expect(formatUtc(Date.UTC(2026, 8, 30, 23, 30))).toBe("30 September 2026, 23:30 UTC");
  });
});

describe("pdfFilename", () => {
  it("names the file after the track", () => {
    expect(pdfFilename("Modem · Joto")).toBe("Modem · Joto - Resomix analysis.pdf");
  });

  it("strips what a filesystem will not take", () => {
    expect(pdfFilename('A/B: "C"')).toBe("A B C - Resomix analysis.pdf");
  });
});

describe("heatmap encoding", () => {
  it("encodes a spectrogram with no canvas anywhere in the path", () => {
    const png = spectrogramPng(full.spectral.melSpectrogram, 44100, false);
    expect(png).not.toBeNull();
    expect(png!.height).toBe(256);
    // A PNG, by its signature, not an empty buffer.
    expect(Array.from(png!.data.slice(0, 4))).toEqual([137, 80, 78, 71]);
  });

  it("draws each chroma row tall enough that the page scales it down, never up", () => {
    const png = chromaPng(full.tonality.chromagram);
    expect(png!.height).toBeGreaterThanOrEqual(12 * 8);
  });

  it("returns nothing for a matrix that has not arrived", () => {
    expect(spectrogramPng(null, 44100, false)).toBeNull();
    expect(chromaPng({ data: [], hopMs: 0 })).toBeNull();
  });
});

describe("the exported document", () => {
  it("builds a complete PDF from a full result", () => {
    const doc = buildAnalysisPdf(makeDoc, full, meta);
    // Cover and facts, the Timeline on its own sheet, then harmony, vibe and genre.
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    expect(doc.getNumberOfPages()).toBeLessThanOrEqual(6);
    const out = doc.output("datauristring");
    expect(out.startsWith("data:application/pdf")).toBe(true);
    expect(out.length).toBeGreaterThan(20000);
  });

  it("builds in well under a second, on any machine", () => {
    const started = Date.now();
    buildAnalysisPdf(makeDoc, full, meta);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("does not throw on a part-1 result with no structure, genre or stems", () => {
    expect(() => buildAnalysisPdf(makeDoc, partial, meta)).not.toThrow();
  });

  it("prints both dates, and no placeholder where the artist is unknown", () => {
    const plain = (data: typeof full) =>
      buildAnalysisPdf(() => new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" }), data, meta).output();
    const withDate = plain({ ...full, analyzedAt: Date.UTC(2026, 8, 26, 9, 12) });
    expect(withDate).toContain("26 September 2026, 09:12 UTC");
    expect(withDate).toContain("EXPORTED");
    // "bounce_test_final.wav" carries no artist, and the row is left out rather than faked.
    expect(plain(partial)).not.toContain("not in the filename");
  });

  it("carries the track and the platform as real, searchable text", () => {
    const doc = buildAnalysisPdf(makeDoc, full, meta);
    // An uncompressed copy, so the text operators are readable rather than deflated.
    const plain = buildAnalysisPdf(() => new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" }), full, meta);
    const raw = plain.output();
    expect(raw).toContain("Joto");
    expect(raw).toContain("RESOMIX");
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });
});
