import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { mapCanonicalToAnalysisData } from "../pages/analysis/mapCanonical.js";
import { TimelineTab } from "../components/Analysis/timeline/TimelineTab.js";
import { HarmonyTab } from "../components/Analysis/HarmonyTab.js";
import { VibeTab } from "../components/Analysis/VibeTab.js";
import { GenreTab } from "../components/Analysis/GenreTab.js";
import { AnalysisStickyPlayer } from "../components/Analysis/AnalysisStickyPlayer.js";

/**
 * A mount test for the four redesigned tabs and the sticky player.
 *
 * They read two dozen fields off `AnalysisData` between them, several of which are null on a real
 * partial result, and a page that throws on mount shows nothing at all. So each one is rendered
 * against a mapped payload, then against a MINIMAL one where the model pass has not happened yet.
 */

// jsdom has no 2D canvas; every canvas here calls getContext in an effect and early-returns when
// it is falsy, so stub it to null and let the components mount.
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

const full = mapCanonicalToAnalysisData({
  identity: { input_filename: "track.mp3", duration_ms: 240000, sample_rate_hz: 44100, channels: 2, codec: "mp3", bit_rate: 320000 },
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
      { start_ms: 0, end_ms: 120000, label: "intro", word: "intro", number: "1", shown: "intro 1", bars: 32, start_bar: 1 },
      { start_ms: 120000, end_ms: 240000, label: "drop", word: "groove", number: "1", shown: "groove 1", bars: 64, start_bar: 33 },
    ],
  },
  semantics: {
    genre_top: [{ label: "Electronic---Tech House", score: 0.72 }, { label: "Electronic---Techno", score: 0.18 }],
    style_maest_top: [{ label: "Electronic---Tech House", score: 0.61 }, { label: "Electronic---Minimal", score: 0.4 }],
    mood_theme_top: [
      { label: "energetic", score: 0.78 }, { label: "deep", score: 0.64 }, { label: "dark", score: 0.31 },
      { label: "funny", score: 0.28 }, { label: "party", score: 0.24 }, { label: "retro", score: 0.19 },
      { label: "sexy", score: 0.12 }, { label: "sport", score: 0.08 },
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

const noop = () => {};

describe("Timeline tab", () => {
  it("names every lane and prints the track's own summary", () => {
    render(
      <TimelineTab data={full} durationMs={240000} currentMs={60000} onSeek={noop} isDesktop compact={false} onToggleCompact={noop} pending={false} />,
    );
    for (const lane of ["Structure", "Energy", "Spectrum", "Pitch", "Stems"]) {
      expect(screen.getByText(lane)).toBeInTheDocument();
    }
    expect(screen.getByText(/32-bar intro/)).toBeInTheDocument();
    expect(screen.getByText(/124 BPM/)).toBeInTheDocument();
    // Heat-row names are shortened like everywhere else; the raw model label is far too long for
    // the gutter and truncated to "electronic---te…".
    expect(screen.getByText("Tech House")).toBeInTheDocument();
    expect(screen.queryByText("Electronic---Tech House")).not.toBeInTheDocument();
  });

  it("keeps the lanes in place while part 2 is still computing", () => {
    render(
      <TimelineTab data={partial} durationMs={240000} currentMs={0} onSeek={noop} isDesktop compact={false} onToggleCompact={noop} pending />,
    );
    expect(screen.getAllByText(/still computing/).length).toBeGreaterThan(0);
  });
});

describe("Harmony tab", () => {
  it("shows the key, the compatible keys and the ambiguity warning", () => {
    render(<HarmonyTab data={full} />);
    expect(screen.getByText("Mix-compatible keys")).toBeInTheDocument();
    expect(screen.getByText("Note energy")).toBeInTheDocument();
    expect(screen.getByText(/Key may be ambiguous/)).toBeInTheDocument();
    // 4A's neighbours: itself, 3A, 5A and its relative major. ("4A" is also on the wheel.)
    for (const code of ["4A", "3A", "5A", "4B"]) expect(screen.getAllByText(code).length).toBeGreaterThan(0);
  });

  it("mounts on a result whose key has not been read yet", () => {
    render(<HarmonyTab data={partial} />);
    expect(screen.getByText("Key")).toBeInTheDocument();
  });
});

describe("Vibe tab", () => {
  it("meters the perceptual profile and weights the mood tags", () => {
    render(<VibeTab data={full} />);
    expect(screen.getByText("Perceptual profile")).toBeInTheDocument();
    expect(screen.getByText("Danceable")).toBeInTheDocument();
    // Twice over: the plot's axis label, and the track's strongest mood tag.
    expect(screen.getAllByText("energetic")).toHaveLength(2);
    // Six pills whatever the scores are, then the rest named once underneath.
    expect(screen.getByText("retro")).toBeInTheDocument();
    expect(screen.queryByText("sexy")).not.toBeInTheDocument();
    expect(screen.getByText(/hidden: sexy 12 · sport 8/)).toBeInTheDocument();
  });
});

describe("Genre tab", () => {
  it("merges the two models into one list", () => {
    render(<GenreTab data={full} onOpenTimeline={noop} />);
    // `lowercase` is a CSS class, so the text itself keeps the model's own casing.
    expect(screen.getByText("Tech House")).toBeInTheDocument();
    expect(screen.getByText("72% · 61%")).toBeInTheDocument();
    // A label only one model found still appears, with a dash for the other.
    expect(screen.getByText("— · 40%")).toBeInTheDocument();
  });
});

describe("Sticky player", () => {
  it("names the section under the playhead", () => {
    render(
      <AnalysisStickyPlayer data={full} durationMs={240000} currentMs={180000} playing={false} volume={1} onTogglePlay={noop} onSeek={noop} onVolume={noop} isDesktop />,
    );
    expect(screen.getByText("groove 1")).toBeInTheDocument();
    expect(screen.getByText(/bar 33/)).toBeInTheDocument();
    expect(screen.getByLabelText("Play")).toBeInTheDocument();
  });

  it("names the opening section at the very start, on a phone too", () => {
    render(
      <AnalysisStickyPlayer data={full} durationMs={240000} currentMs={0} playing={false} volume={1} onTogglePlay={noop} onSeek={noop} onVolume={noop} isDesktop={false} />,
    );
    expect(screen.getByText("intro 1")).toBeInTheDocument();
  });

  it("falls back to the bass entry where the reading names no section", () => {
    const unnamed = { ...full, energy: { ...full.energy, structureSegments: [] } };
    render(
      <AnalysisStickyPlayer data={unnamed} durationMs={240000} currentMs={0} playing={false} volume={1} onTogglePlay={noop} onSeek={noop} onVolume={noop} isDesktop />,
    );
    expect(screen.getByText(/bass in @ 15s/)).toBeInTheDocument();
  });
});
