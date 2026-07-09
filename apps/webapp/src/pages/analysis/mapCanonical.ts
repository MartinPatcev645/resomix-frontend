/**
 * mapCanonicalToAnalysisData — adapt the analysis-service canonical JSON (snake_case,
 * `resomix-analysis-1.x`) to the camelCase `AnalysisData` the dashboard renders.
 *
 * The backend result is additive and degrades gracefully: any stage can fail and
 * leave its section null/partial. This mapper is therefore defensive — missing
 * numbers become 0, missing lists become [], missing curves become empty — so the
 * page never crashes on a partial result.
 */

import type {
  AnalysisData,
  LabelSeries,
  Matrix,
  ScoredLabel,
  Series,
  StemMetrics,
  StructureSegment,
  TimelineTrack,
  VoiceRegion,
} from "./data.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const series = (s: any): Series =>
  s ? { values: arr<number>(s.values), hopMs: num(s.hop_ms), unit: s.unit ?? null } : { values: [], hopMs: 0, unit: null };

const matrix = (m: any): Matrix =>
  m ? { data: arr<number[]>(m.data), rowLabels: m.row_labels ?? null, hopMs: num(m.hop_ms) } : { data: [], rowLabels: null, hopMs: 0 };

const scored = (list: any): ScoredLabel[] =>
  arr<any>(list).map((x) => ({ label: str(x?.label), score: num(x?.score) }));

const labelSeries = (list: any): LabelSeries[] =>
  arr<any>(list).map((x) => ({ label: str(x?.label), values: arr<number>(x?.values) }));

const track = (t: any): TimelineTrack =>
  t ? { series: labelSeries(t.series), hopMs: num(t.hop_ms) } : { series: [], hopMs: 0 };

const regions = (list: any): VoiceRegion[] =>
  arr<any>(list).map((r) => ({ startMs: num(r?.start_ms), endMs: num(r?.end_ms), meanScore: num(r?.mean_score) }));

const segments = (list: any): StructureSegment[] =>
  arr<any>(list).map((s) => ({ startMs: num(s?.start_ms), endMs: num(s?.end_ms), label: str(s?.label), confidence: num(s?.confidence) }));

const numberRecord = (obj: any): Record<string, number> => {
  const out: Record<string, number> = {};
  if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) out[k] = num(v);
  return out;
};

const stemRecord = (obj: any): Record<string, StemMetrics> => {
  const out: Record<string, StemMetrics> = {};
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries<any>(obj)) {
      out[k] = { energyCurve: series(v?.energy_curve), presencePct: num(v?.presence_pct) };
    }
  }
  return out;
};

export function mapCanonicalToAnalysisData(raw: any): AnalysisData {
  const id = raw?.identity ?? {};
  const tech = raw?.technical ?? {};
  const rhy = raw?.rhythm ?? {};
  const ton = raw?.tonality ?? {};
  const spec = raw?.spectral ?? {};
  const en = raw?.energy ?? {};
  const sem = raw?.semantics ?? {};
  const tl = raw?.timeline ?? {};
  const comp = raw?.composition ?? {};

  const beats = arr<number>(rhy.beat_times_seconds);

  return {
    identity: {
      filename: str(id.input_filename, "track"),
      durationMs: num(id.duration_ms),
      sampleRateHz: num(id.sample_rate_hz),
      bitRate: num(id.bit_rate),
      channels: num(id.channel_count),
      codec: str(id.codec),
    },
    technical: {
      integratedLufs: num(tech.integrated_loudness_lufs),
      loudnessRangeLu: num(tech.loudness_range_lu),
      truePeakDbtp: num(tech.true_peak_dbtp),
      averageLoudnessDb: num(tech.average_loudness_db),
      crestFactor: num(tech.crest_factor),
      loudnessCurve: series(tech.loudness_curve),
      rmsEnergyCurve: series(tech.rms_energy_curve),
    },
    rhythm: {
      // null (not 0) while the GPU tempo is still loading -> UI shows a loader.
      bpm: typeof rhy.bpm === "number" ? rhy.bpm : null,
      confidence: num(rhy.confidence),
      beatTimesSeconds: beats,
      beatCount: beats.length,
      barCount: num(rhy.bar_count),
      downbeatsSeconds: arr<number>(rhy.downbeats_seconds),
      phraseBoundariesSeconds: arr<number>(rhy.phrase_boundaries_seconds),
    },
    tonality: {
      key: ton.key ?? null,
      scale: ton.scale ?? null,
      strength: num(ton.strength),
      camelot: ton.camelot ?? null,
      chromagram: matrix(ton.chromagram),
    },
    spectral: {
      centroidCurve: series(spec.centroid_curve),
      rolloffCurve: series(spec.rolloff_curve),
      flatnessCurve: series(spec.flatness_curve),
      bandwidthCurve: series(spec.bandwidth_curve),
      zcrCurve: series(spec.zcr_curve),
      melSpectrogram: matrix(spec.mel_spectrogram),
    },
    energy: {
      energyCurve: series(en.energy_curve),
      onsetTimesSeconds: arr<number>(en.onset_times_seconds),
      structureSegments: segments(en.structure_segments),
      bassEntryMs: num(en.bass_entry_ms),
    },
    semantics: {
      genreTop: scored(sem.genre_top),
      styleMaestTop: scored(sem.style_maest_top),
      moodThemeTop: scored(sem.mood_theme_top),
      instrumentTop: scored(sem.instrument_top),
      moodDimensions: numberRecord(sem.mood_dimensions),
      danceability: num(sem.danceability),
      approachability: num(sem.approachability),
      voiceInstrumental: str(sem.voice_instrumental, "instrumental"),
      voiceScore: num(sem.voice_score),
      timbreBright: num(sem.timbre_bright),
      timbreDark: num(sem.timbre_dark),
      moodAcoustic: num(sem.mood_acoustic),
      moodElectronic: num(sem.mood_electronic),
      valence: num(sem.valence),
      arousal: num(sem.arousal),
    },
    timeline: {
      genreOverTime: track(tl.genre_over_time),
      moodOverTime: track(tl.mood_over_time),
      instrumentOverTime: track(tl.instrument_over_time),
      voiceRegions: regions(tl.voice_regions),
    },
    composition: {
      stems: stemRecord(comp.stems),
      vocalRegions: regions(comp.vocal_regions),
    },
  };
}
