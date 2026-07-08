/**
 * AnalysisPage — track upload + full "anatomy" dashboard.
 *
 * TESTING PHASE: the data is the hardcoded sample from `useTrackAnalysis`
 * (a real analysis of "Ibiza Afrodeep — Original Mix"). Uploading a track runs
 * the simulated job flow and then renders every panel. Wiring to the live
 * resomix-analysis-service happens later (see useTrackAnalysis.ts).
 */

import { useRef, useState } from "react";
import { useTrackAnalysis } from "./analysis/useTrackAnalysis.js";
import { ACCENT, BarList, Gauge, LineChart, MoodMap, MultiLineChart, Panel, StatCard, TagChips } from "./analysis/charts.js";
import { CamelotWheel, Donut, Heatmap, MoodRadar, RibbonChart, StemArea, StructureTimeline, WaveTimeline } from "./analysis/heatviz.js";

const shortGenre = (l: string) => l.split("---").pop() ?? l;
const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function AnalysisPage() {
  const { status, data, progress, fileName, analyze, reset } = useTrackAnalysis();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cursorMs, setCursorMs] = useState<number | null>(null);

  const activeSection = data?.energy.structureSegments.find(
    (s) => cursorMs != null && cursorMs >= s.startMs && cursorMs < s.endMs,
  );

  const pick = (file?: File | null) => {
    if (file) analyze(file);
  };

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 pb-[var(--px-80)] tracking-[var(--px-1)]">
      <div className="mx-auto w-full max-w-6xl text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="font-helvetica text-[length:var(--px-52)] leading-[var(--px-60)] font-medium uppercase">
            Analysis
          </h1>
          <p className="mt-[var(--px-8)] font-helvetica text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80">
            Upload a track to see what it's actually made of
          </p>
        </header>

        {/* ---------------------------------------------------------- Upload */}
        {status !== "done" && (
          <div className="mx-auto w-full max-w-2xl">
            <button
              type="button"
              onClick={() => status === "idle" && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (status === "idle") pick(e.dataTransfer.files?.[0]);
              }}
              className={
                "flex w-full flex-col items-center gap-[var(--px-12)] rounded-[var(--px-16)] border border-dashed " +
                "p-[var(--px-56)] text-center transition-colors " +
                (dragOver ? "bg-[var(--opacity-15)]" : "bg-[var(--opacity-10)]") +
                " " +
                (status === "idle" ? "cursor-pointer hover:bg-[var(--opacity-15)]" : "cursor-default")
              }
              style={{ borderColor: dragOver ? ACCENT : "var(--opacity-30)" }}
            >
              {status === "idle" ? (
                <>
                  <span className="font-helvetica text-[length:var(--px-16)] font-medium uppercase">Drop a track</span>
                  <span className="font-helvetica text-[length:var(--px-11)] opacity-50">
                    or click to browse · MP3 · WAV · FLAC · AIFF
                  </span>
                </>
              ) : (
                <div className="w-full max-w-md">
                  <div className="mb-[var(--px-10)] font-helvetica text-[length:var(--px-12)] uppercase opacity-70">
                    {status === "uploading" ? "Uploading" : "Analyzing"} · {fileName}
                  </div>
                  <div className="h-[var(--px-6)] w-full overflow-hidden rounded-full bg-[var(--opacity-15)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${progress}%`, background: ACCENT }}
                    />
                  </div>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.flac,.aiff,.aif"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------- Dashboard */}
        {status === "done" && data && (
          <div className="flex flex-col gap-[var(--px-20)]">
            {/* headline row */}
            <div className="flex flex-wrap items-center justify-between gap-[var(--px-12)]">
              <div className="min-w-0">
                <div className="truncate font-helvetica text-[length:var(--px-18)] font-medium">
                  {data.identity.filename}
                </div>
                <div className="font-helvetica text-[length:var(--px-10)] opacity-50">
                  {data.identity.codec.toUpperCase()} · {Math.round(data.identity.bitRate / 1000)} kbps ·{" "}
                  {data.identity.channels === 2 ? "stereo" : "mono"} · {data.identity.sampleRateHz / 1000} kHz
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-[var(--opacity-30)] px-[var(--px-16)] py-[var(--px-6)] font-helvetica text-[length:var(--px-11)] uppercase hover:bg-[var(--opacity-15)]"
              >
                Analyze another
              </button>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-[var(--px-12)] md:grid-cols-5">
              <StatCard label="Tempo" value={`${data.rhythm.bpm}`} sub={`${(data.rhythm.confidence * 100).toFixed(0)}% conf · ${data.rhythm.beatCount} beats`} />
              <StatCard label="Key" value={`${data.tonality.key} ${data.tonality.scale === "major" ? "maj" : "min"}`} sub={`Camelot ${data.tonality.camelot}`} />
              <StatCard label="Loudness" value={`${data.technical.integratedLufs}`} sub="LUFS integrated" />
              <StatCard label="Duration" value={fmtDuration(data.identity.durationMs)} sub={`${data.rhythm.bpm} BPM`} />
              <StatCard label="Top genre" value={<span className="text-[length:var(--px-16)]">{shortGenre(data.semantics.genreTop[0].label)}</span>} sub={`${(data.semantics.genreTop[0].score * 100).toFixed(0)}% match`} />
            </div>

            {/* structure */}
            <Panel
              title="Structure"
              subtitle={`${data.energy.structureSegments.length} sections · ${data.rhythm.barCount} bars · click to seek`}
              right={
                <div className="text-right font-helvetica text-[length:var(--px-9)] opacity-60">
                  {activeSection ? (
                    <span className="uppercase">{activeSection.label}</span>
                  ) : (
                    <span>bass in @ {(data.energy.bassEntryMs / 1000).toFixed(0)}s</span>
                  )}
                </div>
              }
            >
              <StructureTimeline
                segments={data.energy.structureSegments}
                durationMs={data.identity.durationMs}
                cursorMs={cursorMs}
                onSeek={setCursorMs}
              />
            </Panel>

            {/* waveform + beat grid */}
            <Panel title="Waveform & beat grid" subtitle="energy silhouette · phrase lines · bass entry · click to seek">
              <WaveTimeline
                energy={data.energy.energyCurve.values}
                beatTimes={data.rhythm.beatTimesSeconds}
                onsetTimes={data.energy.onsetTimesSeconds}
                phraseBoundaries={data.rhythm.phraseBoundariesSeconds}
                bassEntryMs={data.energy.bassEntryMs}
                voiceRegions={data.timeline.voiceRegions}
                durationMs={data.identity.durationMs}
                cursorMs={cursorMs}
                onSeek={setCursorMs}
              />
            </Panel>

            <div className="grid grid-cols-1 gap-[var(--px-20)] lg:grid-cols-2">
              {/* loudness / dynamics */}
              <Panel
                title="Loudness & dynamics"
                subtitle="short-term loudness vs RMS energy"
                right={
                  <div className="text-right font-helvetica text-[length:var(--px-9)] opacity-60">
                    LRA {data.technical.loudnessRangeLu} LU · peak {data.technical.truePeakDbtp} dB · crest {data.technical.crestFactor}
                  </div>
                }
              >
                <MultiLineChart
                  lines={[
                    { label: "loudness (LUFS)", series: data.technical.loudnessCurve, color: ACCENT },
                    { label: "rms energy", series: data.technical.rmsEnergyCurve, color: "#7fb0ff" },
                  ]}
                />
              </Panel>

              {/* energy journey */}
              <Panel title="Energy journey" subtitle="normalized intensity across the track">
                <LineChart series={data.energy.energyCurve} height={110} format={(v) => `${(v * 100).toFixed(0)}%`} />
              </Panel>
            </div>

            {/* spectrum */}
            <Panel title="Mel-spectrogram" subtitle="frequency content over time (low → high)">
              <Heatmap matrix={data.spectral.melSpectrogram} height={170} />
            </Panel>

            {/* semantic evolution */}
            <Panel title="Evolution over time" subtitle="genre · mood · instruments across the track — brighter = stronger">
              <div className="flex flex-col gap-[var(--px-18)]">
                <div>
                  <div className="mb-[var(--px-6)] font-helvetica text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-50">Genre</div>
                  <RibbonChart track={data.timeline.genreOverTime} />
                </div>
                <div>
                  <div className="mb-[var(--px-6)] font-helvetica text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-50">Mood</div>
                  <RibbonChart track={data.timeline.moodOverTime} />
                </div>
                <div>
                  <div className="mb-[var(--px-6)] font-helvetica text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-50">Instruments</div>
                  <RibbonChart track={data.timeline.instrumentOverTime} />
                </div>
              </div>
            </Panel>

            {/* composition (stems) */}
            <Panel
              title="Composition (stems)"
              subtitle="Demucs source separation — stacked stem energy over time"
              right={
                <div className="text-right font-helvetica text-[length:var(--px-9)] opacity-60">
                  bass in @ {(data.composition.bassEntryMs / 1000).toFixed(0)}s · {data.composition.device.toUpperCase()}
                </div>
              }
            >
              <div className="grid grid-cols-1 items-center gap-[var(--px-16)] lg:grid-cols-[1fr_auto]">
                <StemArea stems={data.composition.stems} />
                <Donut stems={data.composition.stems} />
              </div>
            </Panel>

            <div className="grid grid-cols-1 gap-[var(--px-20)] lg:grid-cols-2">
              {/* vibe */}
              <Panel title="Vibe" subtitle="mood profile · emotion · perceptual gauges">
                <div className="grid grid-cols-1 items-center gap-[var(--px-16)] sm:grid-cols-3">
                  <div>
                    <div className="mb-[var(--px-6)] text-center font-helvetica text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] opacity-50">Mood</div>
                    <MoodRadar dims={data.semantics.moodDimensions} />
                  </div>
                  <div>
                    <div className="mb-[var(--px-6)] text-center font-helvetica text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] opacity-50">Valence · Arousal</div>
                    <MoodMap valence={data.semantics.valence} arousal={data.semantics.arousal} />
                  </div>
                  <div className="grid grid-cols-2 gap-[var(--px-16)]">
                    <Gauge value={data.semantics.danceability} label="Danceable" />
                    <Gauge value={data.semantics.approachability} label="Approachable" />
                    <Gauge value={data.semantics.voiceScore} label="Vocal" sub={data.semantics.voiceInstrumental} />
                    <Gauge value={data.semantics.timbreBright} label="Bright" sub="vs dark" />
                  </div>
                </div>
              </Panel>

              {/* harmony */}
              <Panel title="Harmony" subtitle={`${data.tonality.key} ${data.tonality.scale} · ${(data.tonality.strength * 100).toFixed(0)}% strength`}>
                <div className="grid grid-cols-1 items-center gap-[var(--px-12)] sm:grid-cols-2">
                  <CamelotWheel camelot={data.tonality.camelot} />
                  <div>
                    <div className="mb-[var(--px-6)] font-helvetica text-[length:var(--px-10)] uppercase opacity-50">Chromagram</div>
                    <Heatmap matrix={data.tonality.chromagram} height={130} />
                  </div>
                </div>
              </Panel>
            </div>

            {/* composition */}
            <div className="grid grid-cols-1 gap-[var(--px-20)] lg:grid-cols-3">
              <Panel title="Genre" subtitle="Discogs-400 top matches">
                <BarList items={data.semantics.genreTop} labelTransform={shortGenre} />
              </Panel>
              <Panel title="Instrumentation" subtitle="detected instruments">
                <BarList items={data.semantics.instrumentTop} />
              </Panel>
              <Panel title="Mood / theme" subtitle="MTG-Jamendo tags">
                <TagChips items={data.semantics.moodThemeTop} />
              </Panel>
            </div>

            {/* spectral descriptors */}
            <Panel title="Timbre over time" subtitle="spectral centroid · rolloff · flatness">
              <MultiLineChart
                height={120}
                lines={[
                  { label: "centroid", series: data.spectral.centroidCurve, color: ACCENT },
                  { label: "rolloff", series: data.spectral.rolloffCurve, color: "#7fb0ff" },
                  { label: "flatness", series: data.spectral.flatnessCurve, color: "#8fd694" },
                ]}
              />
            </Panel>

            <p className="text-center font-helvetica text-[length:var(--px-9)] opacity-30">
              Sample data · measured (tempo/key/loudness) vs predicted (genre/mood/instruments)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
