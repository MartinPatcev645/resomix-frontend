// Canonical analysis shape (camelCase) the dashboard renders. The live snake_case
// result from the analysis service is adapted into this by `mapCanonical.ts`.
// Every field here is used by the UI — there is no hardcoded sample data.

export type Series = { values: number[]; hopMs: number; unit?: string | null };
export type Matrix = { data: number[][]; rowLabels?: string[] | null; hopMs: number };
export type ScoredLabel = { label: string; score: number };
export type StructureSegment = { startMs: number; endMs: number; label: string; confidence: number };
export type LabelSeries = { label: string; values: number[] };
export type TimelineTrack = { series: LabelSeries[]; hopMs: number };
export type VoiceRegion = { startMs: number; endMs: number; meanScore: number };
export type StemMetrics = { energyCurve: Series; presencePct: number };

export interface AnalysisData {
  identity: { filename: string; durationMs: number; sampleRateHz: number; bitRate: number; channels: number; codec: string };
  technical: { integratedLufs: number; loudnessRangeLu: number; truePeakDbtp: number; averageLoudnessDb: number; crestFactor: number; loudnessCurve: Series; rmsEnergyCurve: Series };
  rhythm: { bpm: number; confidence: number; beatTimesSeconds: number[]; beatCount: number; barCount: number; downbeatsSeconds: number[]; phraseBoundariesSeconds: number[] };
  tonality: { key: string; scale: string; strength: number; camelot: string; chromagram: Matrix };
  spectral: { centroidCurve: Series; rolloffCurve: Series; flatnessCurve: Series; bandwidthCurve: Series; zcrCurve: Series; melSpectrogram: Matrix };
  energy: { energyCurve: Series; onsetTimesSeconds: number[]; structureSegments: StructureSegment[]; bassEntryMs: number };
  semantics: { genreTop: ScoredLabel[]; styleMaestTop: ScoredLabel[]; moodThemeTop: ScoredLabel[]; instrumentTop: ScoredLabel[]; moodDimensions: Record<string, number>; danceability: number; approachability: number; voiceInstrumental: string; voiceScore: number; timbreBright: number; timbreDark: number; moodAcoustic: number; moodElectronic: number; valence: number; arousal: number };
  timeline: { genreOverTime: TimelineTrack; moodOverTime: TimelineTrack; instrumentOverTime: TimelineTrack; voiceRegions: VoiceRegion[] };
  composition: { stems: Record<string, StemMetrics>; vocalRegions: VoiceRegion[] };
}
