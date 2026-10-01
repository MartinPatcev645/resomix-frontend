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
  StructureInfo,
  StructureSegment,
  TimelineTrack,
  VoiceRegion,
} from "./data.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
/**
 * Like `num`, but a missing number stays missing.
 *
 * `num`'s zero default is right for a curve or a score, where 0 is a real reading and an empty
 * chart is the honest result. It is wrong for a measurement: a track with no loudness range
 * rendered as "LRA 0.0 LU", which is not "we could not measure it", it is a specific and false
 * claim about the master. Use this wherever 0 would be indistinguishable from a real value.
 */
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const series = (s: any): Series =>
  s ? { values: arr<number>(s.values), hopMs: num(s.hop_ms), unit: s.unit ?? null } : { values: [], hopMs: 0, unit: null };

const matrix = (m: any): Matrix =>
  m ? { data: arr<number[]>(m.data), rowLabels: m.row_labels ?? null, hopMs: num(m.hop_ms) } : { data: [], rowLabels: null, hopMs: 0 };

/**
 * The detailed style list. Alwyzon serves it as `style_top`. An Alwyzon from before that rename
 * sends the same list under another `style_<name>_top` key, so when the frontend is deployed first
 * that key is read instead and the Genre tab never goes blank. Safe to drop once every Alwyzon
 * serves `style_top`.
 */
const styleList = (sem: any): unknown => {
  if (sem?.style_top !== undefined) return sem.style_top;
  const legacy = Object.keys(sem ?? {}).find((k) => /^style_[a-z0-9]+_top$/.test(k));
  return legacy ? sem[legacy] : undefined;
};

const scored = (list: any): ScoredLabel[] =>
  arr<any>(list).map((x) => ({ label: str(x?.label), score: num(x?.score) }));

const labelSeries = (list: any): LabelSeries[] =>
  arr<any>(list).map((x) => ({ label: str(x?.label), values: arr<number>(x?.values) }));

const track = (t: any): TimelineTrack =>
  t ? { series: labelSeries(t.series), hopMs: num(t.hop_ms) } : { series: [], hopMs: 0 };

const regions = (list: any): VoiceRegion[] =>
  arr<any>(list).map((r) => ({ startMs: num(r?.start_ms), endMs: num(r?.end_ms), meanScore: num(r?.mean_score) }));

const segments = (list: any): StructureSegment[] =>
  arr<any>(list).map((s) => ({
    startMs: num(s?.start_ms),
    endMs: num(s?.end_ms),
    label: str(s?.label),
    confidence: num(s?.confidence),
    bars: typeof s?.bars === "number" ? s.bars : null,
    flags: arr<string>(s?.flags),
  }));

/**
 * The `structure` block -> the section list plus the whole-track reading.
 *
 * Every section is kept, including the hidden start / end markers, because the strip lays blocks
 * out by width and a missing leading block would shift everything after it. `label` is what the
 * UI prints, so it is the displayed word and its number, never the canonical class: that is what
 * keeps "drop" off a groove track everywhere this list is read, not just where it is drawn.
 *
 * Returns null when the block is absent or carries neither sections nor a gate, which is the
 * signal for "no structure to show" rather than "a track with no sections".
 */
const structureBlock = (block: any): { info: StructureInfo; segments: StructureSegment[] } | null => {
  if (!block || typeof block !== "object") return null;
  const status: StructureInfo["status"] = block.status === "gate" ? "gate" : "ok";
  const segs: StructureSegment[] = arr<any>(block.sections).map((s) => {
    const hidden = s?.hidden === true;
    const word = hidden ? "" : str(s?.word);
    const number = typeof s?.number === "string" && s.number ? ` ${s.number}` : "";
    return {
      startMs: num(s?.start_ms),
      endMs: num(s?.end_ms),
      label: hidden ? "" : `${word}${number}`,
      confidence: 0, // the model publishes no calibrated per-section confidence
      bars: typeof s?.bars === "number" ? s.bars : null,
      flags: [],
      word,
      shown: hidden ? "" : str(s?.shown),
      role: str(s?.label),
      hidden,
      startBar: typeof s?.start_bar === "number" ? s.start_bar : null,
    };
  });
  if (status === "ok" && !segs.some((s) => !s.hidden)) return null;
  return {
    info: {
      status,
      gate: typeof block.gate === "string" ? block.gate : null,
      summary: str(block.summary),
      family: typeof block.family === "string" ? block.family : null,
      vocabulary: typeof block.vocabulary === "string" ? block.vocabulary : null,
      familyReason: typeof block.family_reason === "string" ? block.family_reason : null,
    },
    segments: segs,
  };
};

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
  // Only treat structure_v2 as usable when it actually carries sections: the
  // stage records its own failures in this block rather than failing the run, so
  // an empty one means "fall back to v1", not "this track has no structure".
  const v2 = raw?.structure_v2?.segments?.length ? raw.structure_v2 : null;
  const structure = structureBlock(raw?.structure);
  const tl = raw?.timeline ?? {};
  const comp = raw?.composition ?? {};
  const rd = raw?.readings ?? {};

  const beats = arr<number>(rhy.beat_times_seconds);

  return {
    // The server projected this payload down to the summary card because the caller's plan does
    // not include `can_view_full_analysis`. Every dashboard section is genuinely absent, so the
    // full page must show an upgrade CTA rather than render empty charts over missing data.
    fullAnalysisLocked: raw?.full_analysis_locked === true,
    identity: {
      filename: str(id.input_filename, "track"),
      durationMs: num(id.duration_ms),
      sampleRateHz: num(id.sample_rate_hz),
      bitRate: num(id.bit_rate),
      channels: num(id.channel_count),
      codec: str(id.codec),
    },
    technical: {
      integratedLufs: numOrNull(tech.integrated_loudness_lufs),
      loudnessRangeLu: numOrNull(tech.loudness_range_lu),
      samplePeakDbfs: numOrNull(tech.sample_peak_dbfs),
      truePeakDbtp: numOrNull(tech.true_peak_dbtp),
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
      altCamelot: ton.alt_camelot ?? null,
      ambiguous: typeof ton.ambiguous === "boolean" ? ton.ambiguous : null,
      keyMargin: typeof ton.key_margin === "number" ? ton.key_margin : null,
      tonicInTopChroma: typeof ton.tonic_in_top_chroma === "boolean" ? ton.tonic_in_top_chroma : null,
      tuningHz: typeof ton.tuning_hz === "number" ? ton.tuning_hz : null,
      tuningCents: typeof ton.tuning_cents === "number" ? ton.tuning_cents : null,
      meanChroma: arr<number>(ton.mean_chroma),
    },
    spectral: {
      centroidCurve: series(spec.centroid_curve),
      rolloffCurve: series(spec.rolloff_curve),
      flatnessCurve: series(spec.flatness_curve),
      bandwidthCurve: series(spec.bandwidth_curve),
      zcrCurve: series(spec.zcr_curve),
      melSpectrogram: matrix(spec.mel_spectrogram),
      linearSpectrogram: spec.linear_spectrogram ? matrix(spec.linear_spectrogram) : null,
    },
    energy: {
      energyCurve: series(en.energy_curve),
      onsetTimesSeconds: arr<number>(en.onset_times_seconds),
      // The `structure` block when the service produced it, else the older v2 / v1 maps. Fed in
      // here rather than at each call site so every consumer moves over together, and so results
      // that predate the block keep exactly the sentences they have today. Note the panel and the
      // table are only DRAWN when `structure` below is present: the v1 / v2 readings were
      // withdrawn and must not reappear on old results.
      structureSegments: structure ? structure.segments : segments(v2?.segments ?? en.structure_segments),
      bassEntryMs: num(en.bass_entry_ms),
    },
    structureV2: v2
      ? {
          version: num(v2.version) || 2,
          profile: str(v2.profile, "beatless"),
          grid: {
            bpm: typeof v2.grid?.bpm === "number" ? v2.grid.bpm : null,
            lsqBpm: typeof v2.grid?.lsq_bpm === "number" ? v2.grid.lsq_bpm : null,
            downbeatPhase: typeof v2.grid?.downbeat_phase === "number" ? v2.grid.downbeat_phase : null,
            residualMs: typeof v2.grid?.residual_ms === "number" ? v2.grid.residual_ms : null,
            irregular: typeof v2.grid?.irregular === "boolean" ? v2.grid.irregular : null,
          },
          bpmDisplay: {
            show: v2.bpm_display?.show !== false,
            text: str(v2.bpm_display?.text),
            value: typeof v2.bpm_display?.value === "number" ? v2.bpm_display.value : null,
            reliable: v2.bpm_display?.reliable === true,
          },
          flags: arr<string>(v2.flags),
        }
      : null,
    structure: structure ? structure.info : null,
    semantics: {
      genreTop: scored(sem.genre_top),
      styleTop: scored(styleList(sem)),
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
    // `completed_epoch` is seconds; the app keeps times in milliseconds.
    analyzedAt:
      typeof raw?.provenance?.completed_epoch === "number" && Number.isFinite(raw.provenance.completed_epoch)
        ? raw.provenance.completed_epoch * 1000
        : null,
    readings: {
      forDj: str(rd.for_dj ?? rd.dj ?? rd.for_djs),
      forProducers: str(rd.for_producers ?? rd.producers ?? rd.for_producer),
      forCurators: str(rd.for_curators ?? rd.curators ?? rd.for_curator),
    },
  };
}
