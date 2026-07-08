/**
 * AnalysisPage — track upload + full "anatomy" dashboard.
 *
 * TESTING PHASE: the data is the hardcoded sample from `useTrackAnalysis`
 * (a real analysis of "Ibiza Afrodeep — Original Mix"). Uploading a track runs
 * the simulated job flow and then renders every panel. Wiring to the live
 * resomix-analysis-service happens later (see useTrackAnalysis.ts).
 */

import { useEffect, useRef, useState } from "react";
import { useTrackAnalysis } from "./analysis/useTrackAnalysis.js";
import { ACCENT, BarList, fmtClock, Gauge, LineChart, MoodMap, MultiLineChart, Panel, StatCard, TagChips, TimeAxis, TipRows, useToggleSet, valueAt } from "./analysis/charts.js";
import { CamelotWheel, Donut, Heatmap, MoodRadar, RibbonChart, sectionAt, StemArea, StructureTimeline, WaveTimeline } from "./analysis/heatviz.js";

const shortGenre = (l: string) => l.split("---").pop() ?? l;
const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
// Live BPM is a float (e.g. 123.0 or 128.4); show whole numbers cleanly.
const fmtBpm = (b: number) => (Number.isInteger(b) ? String(b) : b.toFixed(1));

// Tooltip for a ribbon track: EVERY series' value at the hovered time.
const ribbonTip =
  (track: { series: { label: string; values: number[] }[] }, transform?: (l: string) => string) =>
  (f: number) => (
    <TipRows
      rows={track.series.map((s) => ({
        label: transform ? transform(s.label) : s.label,
        value: `${((valueAt(s.values, f) ?? 0) * 100).toFixed(0)}%`,
      }))}
    />
  );

export default function AnalysisPage() {
  const { status, data, error, progress, fileName, audioUrl, analyze, reset } = useTrackAnalysis();
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);

  const durationMs = data?.identity.durationMs ?? 0;

  // Shared seek: drives the <audio> playhead and the synchronized cursor on every
  // full-track graph. Any graph click routes here via TimeAxis.
  const seek = (ms: number) => {
    const clamped = Math.max(0, Math.min(durationMs || ms, ms));
    const a = audioRef.current;
    if (a && Number.isFinite(a.duration)) a.currentTime = clamped / 1000;
    setCurrentMs(clamped);
  };
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  // Reset the playhead whenever a new track loads.
  useEffect(() => {
    setCurrentMs(0);
    setPlaying(false);
  }, [audioUrl]);

  // Stem show/hide selection, shared by the stacked area + the donut.
  const stemNames = data ? Object.keys(data.composition.stems) : [];
  const { hidden: stemsHidden, toggle: toggleStem } = useToggleSet(stemNames.length);

  const activeSection = data?.energy.structureSegments.find(
    (s) => currentMs >= s.startMs && currentMs < s.endMs,
  );

  const pick = (file?: File | null) => {
    if (file) analyze(file);
  };

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-[var(--px-56)] lg:px-[var(--px-80)] pb-[var(--px-80)] tracking-[var(--px-1)]">
      <div className="mx-auto w-full max-w-6xl text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="font-helvetica text-[length:var(--px-52)] leading-[var(--px-60)] font-medium uppercase">
            Analysis
          </h1>
          <p className="mt-[var(--px-8)] font-helvetica text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80">
            Upload a track to see what it's actually made of
          </p>
        </header>

        {/* ----------------------------------------------------------- Error */}
        {status === "error" && (
          <div className="mx-auto w-full max-w-2xl">
            <div
              className="flex flex-col items-center gap-[var(--px-12)] rounded-[var(--px-16)] border border-dashed p-[var(--px-56)] text-center"
              style={{ borderColor: ACCENT }}
            >
              <span className="font-helvetica text-[length:var(--px-14)] font-medium uppercase" style={{ color: ACCENT }}>
                Analysis failed
              </span>
              {fileName && <span className="font-helvetica text-[length:var(--px-11)] opacity-50">{fileName}</span>}
              <span className="max-w-md break-words font-helvetica text-[length:var(--px-11)] opacity-70">
                {error ?? "Something went wrong."}
              </span>
              <button
                type="button"
                onClick={reset}
                className="mt-[var(--px-8)] rounded-full border border-[var(--opacity-30)] px-[var(--px-16)] py-[var(--px-6)] font-helvetica text-[length:var(--px-11)] uppercase hover:bg-[var(--opacity-15)]"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- Upload */}
        {status !== "done" && status !== "error" && (
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

            {/* transport / player */}
            <audio
              ref={audioRef}
              src={audioUrl ?? undefined}
              preload="metadata"
              className="hidden"
              onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            <div className="flex items-center gap-[var(--px-14)] rounded-[var(--px-10)] border border-[var(--opacity-15)] bg-[var(--opacity-10)] px-[var(--px-14)] py-[var(--px-10)]">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black transition-transform hover:scale-105"
              >
                {playing ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-[1px]" fill="currentColor">
                    <path d="M7 5 L19 12 L7 19 Z" />
                  </svg>
                )}
              </button>
              <span className="w-10 shrink-0 font-helvetica text-[length:var(--px-11)] tabular-nums opacity-80">{fmtClock(currentMs)}</span>
              <div
                className="relative h-[var(--px-6)] flex-1 cursor-pointer overflow-hidden rounded-full bg-white/25"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  seek(((e.clientX - r.left) / r.width) * durationMs);
                }}
              >
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${durationMs ? Math.min(100, (currentMs / durationMs) * 100) : 0}%`, background: ACCENT }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-helvetica text-[length:var(--px-11)] tabular-nums opacity-50">{fmtClock(durationMs)}</span>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-[var(--px-12)] md:grid-cols-5">
              <StatCard label="Tempo" value={fmtBpm(data.rhythm.bpm)} sub={`${(data.rhythm.confidence * 100).toFixed(0)}% conf · ${data.rhythm.beatCount} beats`} hint="Tempo in beats per minute, tracked from the onset/beat grid. Confidence reflects how steady the pulse is." />
              <StatCard label="Key" value={`${data.tonality.key} ${data.tonality.scale === "major" ? "maj" : "min"}`} sub={`Camelot ${data.tonality.camelot}`} hint="Estimated musical key & scale (Krumhansl-Kessler), plus its Camelot code for harmonic mixing." />
              <StatCard label="Loudness" value={data.technical.integratedLufs.toFixed(1)} sub="LUFS integrated" hint="Integrated loudness in LUFS (EBU R128) — the overall perceived level across the whole track." />
              <StatCard label="Duration" value={fmtDuration(data.identity.durationMs)} sub={`${fmtBpm(data.rhythm.bpm)} BPM`} hint="Total track length (mm:ss)." />
              <StatCard label="Top genre" value={<span className="text-[length:var(--px-16)]">{shortGenre(data.semantics.genreTop[0].label)}</span>} sub={`${(data.semantics.genreTop[0].score * 100).toFixed(0)}% match`} hint="Most likely genre from the Discogs-400 classifier (see the full ranking below)." />
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
              <TimeAxis
                durationMs={durationMs}
                currentMs={currentMs}
                onSeek={seek}
                tooltip={(f) => {
                  const label = sectionAt(data.energy.structureSegments, durationMs, f);
                  return label ? <span className="ml-[var(--px-6)] uppercase">{label}</span> : null;
                }}
              >
                <StructureTimeline
                  segments={data.energy.structureSegments}
                  durationMs={data.identity.durationMs}
                  currentMs={currentMs}
                />
              </TimeAxis>
            </Panel>

            {/* waveform + beat grid */}
            <Panel title="Waveform & beat grid" subtitle="energy silhouette · phrase lines · bass entry · click / play to seek">
              <TimeAxis
                durationMs={durationMs}
                currentMs={currentMs}
                onSeek={seek}
                tooltip={(f) => {
                  const v = valueAt(data.energy.energyCurve.values, f);
                  return v == null ? null : <span className="ml-[var(--px-6)] tabular-nums">{(v * 100).toFixed(0)}%</span>;
                }}
              >
                <WaveTimeline
                  energy={data.energy.energyCurve.values}
                  beatTimes={data.rhythm.beatTimesSeconds}
                  onsetTimes={data.energy.onsetTimesSeconds}
                  phraseBoundaries={data.rhythm.phraseBoundariesSeconds}
                  bassEntryMs={data.energy.bassEntryMs}
                  voiceRegions={data.timeline.voiceRegions}
                  durationMs={data.identity.durationMs}
                />
              </TimeAxis>
            </Panel>

            <div className="grid grid-cols-1 gap-[var(--px-20)] lg:grid-cols-2">
              {/* loudness / dynamics */}
              <Panel
                title="Loudness & dynamics"
                subtitle="short-term loudness vs RMS energy"
                right={
                  <div className="text-right font-helvetica text-[length:var(--px-9)] opacity-60">
                    LRA {data.technical.loudnessRangeLu.toFixed(1)} LU · peak {data.technical.truePeakDbtp.toFixed(1)} dB · crest {data.technical.crestFactor.toFixed(1)}
                  </div>
                }
              >
                <MultiLineChart
                  durationMs={durationMs}
                  currentMs={currentMs}
                  onSeek={seek}
                  lines={[
                    { label: "loudness (LUFS)", series: data.technical.loudnessCurve, color: ACCENT },
                    { label: "rms energy", series: data.technical.rmsEnergyCurve, color: "#7fb0ff" },
                  ]}
                />
              </Panel>

              {/* energy journey */}
              <Panel title="Energy journey" subtitle="normalized intensity across the track">
                <TimeAxis
                  durationMs={durationMs}
                  currentMs={currentMs}
                  onSeek={seek}
                  tooltip={(f) => {
                    const v = valueAt(data.energy.energyCurve.values, f);
                    return v == null ? null : <span className="ml-[var(--px-6)] tabular-nums">{(v * 100).toFixed(0)}%</span>;
                  }}
                >
                  <LineChart series={data.energy.energyCurve} height={110} />
                </TimeAxis>
              </Panel>
            </div>

            {/* spectrum */}
            <Panel title="Mel-spectrogram" subtitle="frequency content over time (low → high) · click / play to seek">
              <TimeAxis durationMs={durationMs} currentMs={currentMs} onSeek={seek} tooltip={() => null}>
                <Heatmap matrix={data.spectral.melSpectrogram} height={170} />
              </TimeAxis>
            </Panel>

            {/* semantic evolution */}
            <Panel title="Evolution over time" subtitle="genre · mood · instruments across the track — brighter = stronger · click / play to seek">
              <div className="flex flex-col gap-[var(--px-18)]">
                <div>
                  <div className="mb-[var(--px-6)] font-helvetica text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-50">Genre</div>
                  <TimeAxis durationMs={durationMs} currentMs={currentMs} onSeek={seek} tooltip={ribbonTip(data.timeline.genreOverTime, shortGenre)}>
                    <RibbonChart track={data.timeline.genreOverTime} labelTransform={shortGenre} />
                  </TimeAxis>
                </div>
                <div>
                  <div className="mb-[var(--px-6)] font-helvetica text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-50">Mood</div>
                  <TimeAxis durationMs={durationMs} currentMs={currentMs} onSeek={seek} tooltip={ribbonTip(data.timeline.moodOverTime)}>
                    <RibbonChart track={data.timeline.moodOverTime} />
                  </TimeAxis>
                </div>
                <div>
                  <div className="mb-[var(--px-6)] font-helvetica text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-50">Instruments</div>
                  <TimeAxis durationMs={durationMs} currentMs={currentMs} onSeek={seek} tooltip={ribbonTip(data.timeline.instrumentOverTime)}>
                    <RibbonChart track={data.timeline.instrumentOverTime} />
                  </TimeAxis>
                </div>
              </div>
            </Panel>

            {/* composition (stems) */}
            <Panel
              title="Composition (stems)"
              subtitle="Demucs source separation — stacked stem energy over time · click / play to seek"
            >
              <div className="grid grid-cols-1 items-center gap-[var(--px-16)] lg:grid-cols-[1fr_auto]">
                <StemArea
                  stems={data.composition.stems}
                  hidden={stemsHidden}
                  onToggle={toggleStem}
                  durationMs={durationMs}
                  currentMs={currentMs}
                  onSeek={seek}
                />
                <Donut stems={data.composition.stems} hidden={stemsHidden} />
              </div>
            </Panel>

            <div className="grid grid-cols-1 gap-[var(--px-20)] lg:grid-cols-2">
              {/* vibe */}
              <Panel title="Vibe" subtitle="mood profile · emotion · perceptual gauges">
                <div className="flex flex-col gap-[var(--px-16)]">
                  <div className="grid grid-cols-1 items-center gap-[var(--px-16)] sm:grid-cols-2">
                    <div>
                      <div className="mb-[var(--px-6)] text-center font-helvetica text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] opacity-50">Mood</div>
                      <MoodRadar dims={data.semantics.moodDimensions} />
                    </div>
                    <div>
                      <div className="mb-[var(--px-6)] text-center font-helvetica text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] opacity-50">Valence · Arousal</div>
                      <MoodMap valence={data.semantics.valence} arousal={data.semantics.arousal} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-[var(--px-10)]">
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
                    <TimeAxis durationMs={durationMs} currentMs={currentMs} onSeek={seek} tooltip={() => null}>
                      <Heatmap matrix={data.tonality.chromagram} height={130} />
                    </TimeAxis>
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
            <Panel title="Timbre over time" subtitle="spectral centroid · rolloff · flatness · toggle lines below">
              <MultiLineChart
                height={120}
                durationMs={durationMs}
                currentMs={currentMs}
                onSeek={seek}
                lines={[
                  { label: "centroid", series: data.spectral.centroidCurve, color: ACCENT },
                  { label: "rolloff", series: data.spectral.rolloffCurve, color: "#7fb0ff" },
                  { label: "flatness", series: data.spectral.flatnessCurve, color: "#8fd694" },
                ]}
              />
            </Panel>

            <p className="text-center font-helvetica text-[length:var(--px-9)] opacity-30">
              measured (tempo · key · loudness) vs predicted (genre · mood · instruments)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
