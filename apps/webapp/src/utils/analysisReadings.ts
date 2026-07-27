import { shortGenre } from "@resomix/hooks";
import type { AnalysisData, StructureSegment } from "@/pages/analysis/data.ts";
import { keyFromCamelot } from "@/pages/analysis/heatviz.tsx";
import { displayOrNA } from "@/utils/trackUtils.ts";

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function structurePhrase(segments: StructureSegment[]): string {
  if (!segments.length) return "Structure data is N/A for this track.";
  const drop = segments.find((s) => s.label === "drop" || s.label === "chorus");
  const build = segments.find((s) => s.label === "build");
  if (drop && build) {
    return `Structure moves from ${build.label} toward ${drop.label} around ${fmtClock(drop.startMs)}${drop.endMs ? `, sustaining through ${fmtClock(drop.endMs)}` : ""}.`;
  }
  if (drop) {
    return `Structure peaks through ${drop.label} from ${fmtClock(drop.startMs)} to ${fmtClock(drop.endMs)}.`;
  }
  return `${segments.length} structural sections detected across the arrangement.`;
}

function keyPhrase(data: AnalysisData): string {
  const camelot = displayOrNA(data.tonality.camelot);
  const keyLabel = data.tonality.camelot ? keyFromCamelot(data.tonality.camelot) : null;
  if (keyLabel) {
    const scale = keyLabel.scale === "major" ? "major" : "minor";
    return `Tonal centre ${keyLabel.name} ${scale} (${camelot})`;
  }
  return `Tonal centre ${camelot}`;
}

function bpmPhrase(data: AnalysisData): string {
  if (data.rhythm.bpm == null) return "tempo N/A";
  const bpm = Number.isInteger(data.rhythm.bpm) ? String(data.rhythm.bpm) : data.rhythm.bpm.toFixed(1);
  return `steady ${bpm} BPM`;
}

function moodPhrase(data: AnalysisData): string {
  const valence =
    typeof data.semantics.valence === "number" ? `${(data.semantics.valence * 100).toFixed(0)}% valence` : "valence N/A";
  const arousal =
    typeof data.semantics.arousal === "number" ? `${(data.semantics.arousal * 100).toFixed(0)}% arousal` : "arousal N/A";
  const vocal =
    data.semantics.voiceInstrumental === "instrumental"
      ? "instrumental"
      : data.semantics.voiceInstrumental || "vocal presence N/A";
  return `${valence}, ${arousal}, ${vocal}`;
}

/**
 * Interpretive reading templates over available facts — backend readings win when present;
 * missing facts degrade via displayOrNA rather than hiding the block.
 */
export function resolveAnalysisReadings(data: AnalysisData): {
  forDj: string;
  forProducers: string;
  forCurators: string;
} {
  const fromApi = data.readings;
  const style =
    data.semantics.genreTop[0]?.label != null
      ? shortGenre(data.semantics.genreTop[0].label)
      : data.semantics.styleMaestTop[0]?.label != null
        ? shortGenre(data.semantics.styleMaestTop[0].label)
        : "N/A";

  return {
    forDj:
      fromApi.forDj.trim() ||
      `${structurePhrase(data.energy.structureSegments)} ${keyPhrase(data)}, ${bpmPhrase(data)}.`,
    forProducers:
      fromApi.forProducers.trim() ||
      `${keyPhrase(data)}; arrangement develops through texture and intensity. Loudness range ${data.technical.loudnessRangeLu ? data.technical.loudnessRangeLu.toFixed(1) : "N/A"} LU; integrated ${data.technical.integratedLufs ? data.technical.integratedLufs.toFixed(1) : "N/A"} LUFS. Style indicator ${displayOrNA(style)}.`,
    forCurators:
      fromApi.forCurators.trim() ||
      `Reads from measured mood signals (${moodPhrase(data)}). Style indicator ${displayOrNA(style)}; duration ${data.identity.durationMs ? fmtClock(data.identity.durationMs) : "N/A"}.`,
  };
}
