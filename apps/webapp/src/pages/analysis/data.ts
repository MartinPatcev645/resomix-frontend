// Canonical analysis shape (camelCase) the dashboard renders. The live snake_case
// result from the analysis service is adapted into this by `mapCanonical.ts`.
// Every field here is used by the UI — there is no hardcoded sample data.

export type Series = { values: number[]; hopMs: number; unit?: string | null };
export type Matrix = { data: number[][]; rowLabels?: string[] | null; hopMs: number };
export type ScoredLabel = { label: string; score: number };
export type StructureSegment = {
  startMs: number;
  endMs: number;
  label: string;
  confidence: number;
  /** Whole bars spanned. Only present on structure_v2, and null on its wall-clock fallback. */
  bars?: number | null;
  /** structure_v2 provenance, e.g. "review", "snapped_far". */
  flags?: string[];
};

/**
 * The beat-aware structure result. `energy.structureSegments` is already fed from
 * this when it exists, so nothing has to read `segments` here — what this block
 * adds is the two decisions the sections alone cannot express:
 *
 *   `profile`     which vocabulary the labels are drawn from, so copy can avoid
 *                 saying "drop" about a track that has no beat;
 *   `bpmDisplay`  whether a tempo may be shown at all. Essentia returns a BPM for
 *                 everything, including ambient, which is how a beatless track
 *                 ended up captioned "steady 154.8 BPM".
 */
export type StructureV2 = {
  version: number;
  /** "dance" | "downtempo" | "beatless" */
  profile: string;
  grid: { bpm: number | null; lsqBpm: number | null; downbeatPhase: number | null; residualMs: number | null; irregular: boolean | null };
  bpmDisplay: { show: boolean; text: string; value: number | null; reliable: boolean };
  flags: string[];
};
export type LabelSeries = { label: string; values: number[] };
export type TimelineTrack = { series: LabelSeries[]; hopMs: number };
export type VoiceRegion = { startMs: number; endMs: number; meanScore: number };
export type StemMetrics = { energyCurve: Series; presencePct: number };

export interface AnalysisData {
  identity: { filename: string; durationMs: number; sampleRateHz: number; bitRate: number; channels: number; codec: string };
  technical: { integratedLufs: number; loudnessRangeLu: number; truePeakDbtp: number; averageLoudnessDb: number; crestFactor: number; loudnessCurve: Series; rmsEnergyCurve: Series };
  // bpm/key/scale/camelot are null while the GPU (Essentia) value is still loading
  // — the rhythm/tonality stages defer them; the UI shows a loader until they land.
  rhythm: { bpm: number | null; confidence: number; beatTimesSeconds: number[]; beatCount: number; barCount: number; downbeatsSeconds: number[]; phraseBoundariesSeconds: number[] };
  tonality: { key: string | null; scale: string | null; strength: number; camelot: string | null; chromagram: Matrix; altCamelot: string | null; ambiguous: boolean | null; keyMargin: number | null; tonicInTopChroma: boolean | null; tuningHz: number | null; tuningCents: number | null; meanChroma: number[] };
  spectral: { centroidCurve: Series; rolloffCurve: Series; flatnessCurve: Series; bandwidthCurve: Series; zcrCurve: Series; melSpectrogram: Matrix; linearSpectrogram: Matrix | null };
  energy: { energyCurve: Series; onsetTimesSeconds: number[]; structureSegments: StructureSegment[]; bassEntryMs: number };
  /** Null on results produced before structure_v2 existed, or where its stage degraded. */
  structureV2: StructureV2 | null;
  semantics: { genreTop: ScoredLabel[]; styleMaestTop: ScoredLabel[]; moodThemeTop: ScoredLabel[]; instrumentTop: ScoredLabel[]; moodDimensions: Record<string, number>; danceability: number; approachability: number; voiceInstrumental: string; voiceScore: number; timbreBright: number; timbreDark: number; moodAcoustic: number; moodElectronic: number; valence: number; arousal: number };
  timeline: { genreOverTime: TimelineTrack; moodOverTime: TimelineTrack; instrumentOverTime: TimelineTrack; voiceRegions: VoiceRegion[] };
  composition: { stems: Record<string, StemMetrics>; vocalRegions: VoiceRegion[] };
  /** Optional narrative readings from the canonical result (may be absent on partial jobs). */
  readings: { forDj: string; forProducers: string; forCurators: string };
  /**
   * True when the server withheld the dashboard sections because the caller's plan lacks
   * `can_view_full_analysis` (pricing v2.1 §1.6). The summary card is complete either way — only
   * the full Track Intelligence page is gated.
   */
  fullAnalysisLocked?: boolean;
}
