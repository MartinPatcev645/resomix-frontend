import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { mapCanonicalToAnalysisData } from "../pages/analysis/mapCanonical.js";
import { buildExportBlocks, trackFacts, type ExportMeta } from "../components/Analysis/export/ExportDocument.js";
import { paginate } from "../components/Analysis/export/paginate.js";
import { BLOCK_GAP_MAX } from "../components/Analysis/export/exportTheme.js";
import { pdfFilename } from "../components/Analysis/export/exportAnalysisPdf.js";

/**
 * The PDF export, at the three points where it can quietly go wrong: the filename it reads the
 * track's identity out of, the packer that decides where a page turns, and the document itself,
 * which renders every chart a second time and must not throw on a result that is missing half of
 * them.
 */

beforeAll(() => {
  // jsdom has no 2D canvas; the chart components early-return on a null context.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

const meta: ExportMeta = {
  facts: trackFacts("Modem - Joto (Original Mix).mp3"),
  exportedOn: "24 September 2026",
  landingUrl: "https://resomix.com",
  betaUrl: "https://beta.resomix.com",
};

const full = mapCanonicalToAnalysisData({
  identity: { input_filename: "Modem - Joto (Original Mix).mp3", duration_ms: 240000, sample_rate_hz: 44100, channels: 2, codec: "mp3", bit_rate: 320000 },
  technical: {
    integrated_lufs: -8.2,
    rms_energy_curve: { values: [0.2, 0.5, 0.9, 0.4], hop_ms: 60000 },
    loudness_curve: { values: [-12, -9, -7, -10], hop_ms: 60000 },
  },
  rhythm: { bpm: 124, confidence: 0.55, beat_count: 480, downbeats_seconds: [0, 60, 120, 180], bar_count: 120 },
  tonality: {
    key: "F", scale: "minor", camelot: "4A", strength: 0.89, alt_camelot: "7B", ambiguous: true,
    mean_chroma: [0.2, 0.1, 0.3, 0.1, 0.2, 0.9, 0.1, 0.5, 0.2, 0.3, 0.1, 0.2],
    chromagram: { data: [[0.1, 0.2], [0.3, 0.4]], hop_ms: 120000 },
  },
  spectral: { mel_spectrogram: { data: [[-20, -30], [-25, -35]], hop_ms: 120000 } },
  energy: { bass_entry_ms: 15000 },
  structure: {
    status: "ok",
    summary: "32-bar intro · groove 1 from bar 33",
    family: "groove",
    sections: [
      { start_ms: 0, end_ms: 120000, label: "intro", word: "intro", shown: "intro 1", bars: 32, start_bar: 1 },
      { start_ms: 120000, end_ms: 240000, label: "drop", word: "groove", shown: "groove 1", bars: 64, start_bar: 33 },
    ],
  },
  semantics: {
    genre_top: [{ label: "Electronic---Tech House", score: 0.72 }],
    style_maest_top: [{ label: "Electronic---Minimal", score: 0.61 }],
    mood_theme_top: [
      { label: "energetic", score: 0.78 }, { label: "deep", score: 0.64 }, { label: "dark", score: 0.31 },
      { label: "party", score: 0.24 }, { label: "retro", score: 0.19 }, { label: "sexy", score: 0.12 },
      { label: "sport", score: 0.08 },
    ],
    danceability: 0.8, approachability: 0.6, voice_score: 0.2, timbre_bright: 0.55,
    mood_acoustic: 0.1, mood_electronic: 0.95, valence: 0.32, arousal: 0.71,
  },
  timeline: {
    genre_over_time: { hop_ms: 60000, series: [{ label: "Electronic---Tech House", values: [0.6, 0.7, 0.8, 0.5] }] },
    mood_over_time: { hop_ms: 60000, series: [{ label: "energetic", values: [0.4, 0.6, 0.9, 0.7] }] },
    instrument_over_time: { hop_ms: 60000, series: [{ label: "drums", values: [0.9, 0.9, 0.9, 0.8] }] },
  },
  composition: {
    stems: {
      drums: { presence_pct: 92, energy_curve: { values: [0.5, 0.8, 0.9, 0.6], hop_ms: 60000 } },
      bass: { presence_pct: 71, energy_curve: { values: [0.4, 0.5, 0.7, 0.4], hop_ms: 60000 } },
    },
  },
});

/** Part 1 only: no structure, no genre, no stems, and the GPU values still null. */
const partial = mapCanonicalToAnalysisData({
  identity: { input_filename: "track.mp3", duration_ms: 240000, sample_rate_hz: 44100 },
  technical: { integrated_lufs: -8.2 },
  spectral: { mel_spectrogram: { data: [[-20, -30]], hop_ms: 120000 } },
});

const renderDocument = (data: typeof full) =>
  render(
    <>
      {buildExportBlocks(data, meta).map((b) => (
        <div key={b.id}>{b.node}</div>
      ))}
    </>,
  );

describe("trackFacts", () => {
  it("splits artist from title and drops the extension", () => {
    expect(trackFacts("Modem - Joto (Original Mix).mp3")).toMatchObject({
      artist: "Modem",
      title: "Joto (Original Mix)",
    });
  });

  it("drops a leading track number", () => {
    expect(trackFacts("02. Modem - Joto.mp3").artist).toBe("Modem");
  });

  it("claims no artist when the name does not carry one", () => {
    const facts = trackFacts("bounce_test_final.wav");
    expect(facts.artist).toBeNull();
    expect(facts.title).toBe("bounce_test_final");
  });

  it("keeps a hyphenated title whole", () => {
    expect(trackFacts("Artist - Track - Remix Name.mp3").title).toBe("Track - Remix Name");
  });
});

describe("paginate", () => {
  it("fills a page before turning it", () => {
    const pages = paginate(
      [
        { id: "a", height: 400 },
        { id: "b", height: 400 },
        { id: "c", height: 400 },
      ],
      1000,
    );
    expect(pages).toHaveLength(2);
    expect(pages[0].blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(pages[1].blocks.map((b) => b.id)).toEqual(["c"]);
  });

  it("honours a forced break even when the block would have fitted", () => {
    const pages = paginate(
      [
        { id: "a", height: 100 },
        { id: "b", height: 100, breakBefore: true },
      ],
      1000,
    );
    expect(pages).toHaveLength(2);
  });

  it("gives a block taller than the page its own sheet, shrunk to fit", () => {
    const pages = paginate(
      [
        { id: "a", height: 100 },
        { id: "timeline", height: 1200 },
        { id: "b", height: 100 },
      ],
      1000,
    );
    expect(pages.map((p) => p.blocks.map((b) => b.id))).toEqual([["a"], ["timeline"], ["b"]]);
    expect(pages[1].blocks[0].scale).toBeLessThan(1);
    expect(pages[1].blocks[0].scale).toBeGreaterThan(0.8);
  });

  it("never stretches the gap beyond the cap to fill a nearly empty page", () => {
    const [page] = paginate(
      [
        { id: "a", height: 60 },
        { id: "b", height: 60 },
      ],
      1000,
    );
    expect(page.gap).toBeLessThanOrEqual(BLOCK_GAP_MAX);
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

describe("the exported document", () => {
  it("opens with the track, the platform line and both links", () => {
    renderDocument(full);
    // Twice over: the cover states it large, the track facts repeat it as a field.
    expect(screen.getAllByText("Joto (Original Mix)")).toHaveLength(2);
    expect(screen.getAllByText("Modem")).toHaveLength(2);
    expect(screen.getByText(/music similarity search and audio analysis platform/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "resomix.com" })).toHaveAttribute("href", "https://resomix.com");
    expect(screen.getByRole("link", { name: "beta.resomix.com" })).toHaveAttribute("href", "https://beta.resomix.com");
  });

  it("carries all four readings, flattened into sections", () => {
    renderDocument(full);
    for (const heading of ["Timeline", "Harmony", "Vibe", "Genre & Sonic Style", "The track"]) {
      expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/32-bar intro/)).toBeInTheDocument();
    expect(screen.getByText("Mix-compatible keys")).toBeInTheDocument();
    expect(screen.getByText("Note energy")).toBeInTheDocument();
  });

  it("names no model anywhere, exactly as the page does not", () => {
    const { container } = renderDocument(full);
    const text = container.textContent ?? "";
    for (const model of ["MAEST", "Discogs", "maest", "discogs", "Jamendo"]) {
      expect(text).not.toContain(model);
    }
  });

  it("renders a part-1 result without throwing", () => {
    expect(() => renderDocument(partial)).not.toThrow();
    expect(screen.getAllByText("Timeline").length).toBeGreaterThan(0);
  });
});
