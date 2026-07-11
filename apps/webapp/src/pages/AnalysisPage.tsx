/**
 * AnalysisPage — track upload + full "anatomy" dashboard.
 *
 * TESTING PHASE: the data is the hardcoded sample from `useTrackAnalysis`
 * (a real analysis of "Ibiza Afrodeep — Original Mix"). Uploading a track runs
 * the simulated job flow and then renders every panel. Wiring to the live
 * resomix-analysis-service happens later (see useTrackAnalysis.ts).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTrackAnalysis } from "./analysis/useTrackAnalysis.js";
import { ACCENT, BarList, fmtClock, Gauge, LineChart, LoadingStep, MoodMap, MultiLineChart, Panel, Spinner, StatCard, TagChips, TimeAxis, TipRows, useToggleSet, valueAt } from "./analysis/charts.js";
import { CamelotWheel, ChromaView, Donut, MoodRadar, RibbonChart, sectionAt, SpectrogramView, StemArea, StructureTimeline, WaveTimeline } from "./analysis/heatviz.js";

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
  const { status, data, error, progress, fileName, audioUrl, part1Ready, analysisId, analyze, loadById, reset } = useTrackAnalysis();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showBeats, setShowBeats] = useState(false);

  const durationMs = data?.identity.durationMs ?? 0;

  // Keep the <audio> element's volume in sync (re-applied when a new track loads).
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, audioUrl]);

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

  // --- URL <-> analysis id (refresh / shareable result) --------------------
  // On first mount, if the URL carries ?id=, open that analysis directly.
  // useLayoutEffect so the analyzing state is set before paint (no "drop a track"
  // flash on a shared/refreshed link).
  const bootstrapped = useRef(false);
  useLayoutEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const urlId = searchParams.get("id");
    if (urlId) void loadById(urlId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the current analysis id into the URL so refresh / sharing re-opens it.
  useEffect(() => {
    if (!analysisId) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("id", analysisId);
        return next;
      },
      { replace: true },
    );
  }, [analysisId, setSearchParams]);

  // Reset + drop ?id= from the URL (start a fresh upload).
  const resetAll = () => {
    reset();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("id");
        return next;
      },
      { replace: true },
    );
  };

  // Progressive delivery: show the dashboard as soon as part 1 (local DSP) is in;
  // the part-2 (semantic/GPU) panels fill in below once the full result lands.
  const showDashboard = (part1Ready || status === "done") && data;
  const part2Done = status === "done";

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
                onClick={resetAll}
                className="mt-[var(--px-8)] rounded-full border border-[var(--opacity-30)] px-[var(--px-16)] py-[var(--px-6)] font-helvetica text-[length:var(--px-11)] uppercase hover:bg-[var(--opacity-15)]"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- Upload */}
        {(status === "idle" || status === "uploading") && (
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
                accept="audio/*,.mp3,.wav,.flac,.aiff,.aif,.mpeg,.mpg,.m4a,.ogg"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </button>
          </div>
        )}

        {/* ------------------------------------------ Part-1 computing (loader) */}
        {status === "analyzing" && !part1Ready && (
          <div className="mx-auto w-full max-w-2xl">
            <div className="rounded-[var(--px-16)] border border-[var(--opacity-15)] bg-[var(--opacity-10)] p-[var(--px-32)]">
              <div className="mb-[var(--px-16)] truncate font-helvetica text-[length:var(--px-12)] uppercase tracking-[var(--px-1)] opacity-70">
                Analyzing · {fileName}
              </div>
              <div className="flex flex-col gap-[var(--px-16)]">
                <LoadingStep title="Sound & structure" subtitle="tempo · key · loudness · spectrum · sections" />
                <LoadingStep title="Sound, mood & style" subtitle="genre · instruments · stems · emotion" />
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------- Dashboard */}
        {showDashboard && data && (
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
                onClick={resetAll}
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
            <div className="rounded-[var(--px-10)] border border-[var(--opacity-15)] bg-[var(--opacity-10)] px-[var(--px-20)] py-[var(--px-12)]">
              {/* scrub bar — full width so the cursor lines up with the waveform & graphs below */}
              <div
                className="relative h-[var(--px-6)] w-full cursor-pointer overflow-hidden rounded-full bg-white/25"
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

              {/* controls row — play · time · volume, below the scrub bar */}
              <div className="mt-[var(--px-12)] flex items-center gap-[var(--px-12)]">
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
                <span className="shrink-0 font-helvetica text-[length:var(--px-11)] tabular-nums opacity-80">{fmtClock(currentMs)}</span>
                <span className="shrink-0 font-helvetica text-[length:var(--px-11)] tabular-nums opacity-40">/</span>
                <span className="shrink-0 font-helvetica text-[length:var(--px-11)] tabular-nums opacity-50">{fmtClock(durationMs)}</span>

                <div className="flex-1" />

                {/* volume */}
                <div className="flex shrink-0 items-center gap-[var(--px-6)]">
                  <button
                    type="button"
                    onClick={() => setVolume((v) => (v > 0 ? 0 : 1))}
                    aria-label={volume > 0 ? "Mute" : "Unmute"}
                    className="opacity-60 transition-opacity hover:opacity-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-[var(--px-16)] w-[var(--px-16)]" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3z" />
                      {volume === 0 ? (
                        <path d="M16.5 8.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      ) : (
                        <path d="M15.5 8.5a5 5 0 0 1 0 7M17.8 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      )}
                    </svg>
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    aria-label="Volume"
                    className="h-1 w-[var(--px-72)] cursor-pointer"
                    style={{ accentColor: ACCENT }}
                  />
                </div>
              </div>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-2 gap-[var(--px-12)] md:grid-cols-5">
              <StatCard
                label="Tempo"
                value={data.rhythm.bpm == null ? <Spinner size={20} /> : fmtBpm(data.rhythm.bpm)}
                sub={data.rhythm.bpm == null ? "analyzing…" : `${(data.rhythm.confidence * 100).toFixed(0)}% conf · ${data.rhythm.beatCount} beats`}
                hint="Tempo in beats per minute (Essentia RhythmExtractor2013). Confidence reflects how steady the pulse is."
              />
              <StatCard
                label="Key"
                value={data.tonality.key == null ? <Spinner size={20} /> : `${data.tonality.key} ${data.tonality.scale === "major" ? "maj" : "min"}`}
                sub={data.tonality.key == null ? "analyzing…" : `Camelot ${data.tonality.camelot}`}
                hint="Estimated musical key & scale (Essentia EDMA profile, tuned for electronic music), plus its Camelot code for harmonic mixing."
              />
              <StatCard label="Loudness" value={data.technical.integratedLufs.toFixed(1)} sub="LUFS integrated" hint="Integrated loudness in LUFS (EBU R128) — the overall perceived level across the whole track." />
              <StatCard label="Duration" value={fmtDuration(data.identity.durationMs)} sub={data.rhythm.bpm == null ? "— BPM" : `${fmtBpm(data.rhythm.bpm)} BPM`} hint="Total track length (mm:ss)." />
              {data.semantics.genreTop.length > 0 ? (
                <StatCard label="Top genre" value={<span className="text-[length:var(--px-16)]">{shortGenre(data.semantics.genreTop[0].label)}</span>} sub={`${(data.semantics.genreTop[0].score * 100).toFixed(0)}% match`} hint="Most likely genre from the Discogs-400 model (MAEST-30s) — see the full ranking below." />
              ) : (
                <StatCard label="Top genre" value={<Spinner size={20} />} sub="analyzing…" hint="Genre needs the model pass (part 2) — filling in shortly." />
              )}
            </div>

            {/* structure */}
            <Panel
              title="Structure"
              subtitle={`${data.energy.structureSegments.length} sections · ${data.rhythm.barCount || "…"} bars · click to seek`}
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
                  downbeats={data.rhythm.downbeatsSeconds}
                  phraseBoundaries={data.rhythm.phraseBoundariesSeconds}
                  bassEntryMs={data.energy.bassEntryMs}
                  voiceRegions={data.timeline.voiceRegions}
                  durationMs={data.identity.durationMs}
                  showBeats={showBeats}
                />
              </TimeAxis>
              <div className="mt-[var(--px-8)] flex">
                {data.rhythm.bpm == null ? (
                  // beats come from the GPU (Essentia) — loader until they land
                  <span className="flex items-center gap-[var(--px-6)] rounded-full border border-white/15 px-[var(--px-10)] py-[var(--px-3)] font-helvetica text-[length:var(--px-10)] text-white/45">
                    <Spinner size={12} /> Beats
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBeats((v) => !v)}
                    aria-pressed={showBeats}
                    className={
                      "flex items-center gap-[var(--px-6)] rounded-full border px-[var(--px-10)] py-[var(--px-3)] font-helvetica text-[length:var(--px-10)] transition-colors " +
                      (showBeats
                        ? "border-[#EE4A26] bg-[rgba(238,74,38,0.14)] text-white"
                        : "border-white/20 text-white/55 hover:border-white/45 hover:bg-white/5 hover:text-white/90")
                    }
                  >
                    <span
                      className={
                        "grid h-[var(--px-11)] w-[var(--px-11)] place-items-center rounded-[3px] border " +
                        (showBeats ? "border-[#EE4A26] bg-[#EE4A26]" : "border-white/35")
                      }
                    >
                      {showBeats && (
                        <svg viewBox="0 0 10 10" className="h-[var(--px-8)] w-[var(--px-8)]">
                          <path d="M1.5 5 L4 7.5 L8.5 2.5" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    Beats
                  </button>
                )}
              </div>
            </Panel>

            {/* loudness / dynamics — full width */}
            <Panel
              title="Loudness & dynamics"
              subtitle="short-term loudness vs RMS energy"
              right={
                <div className="text-right font-helvetica text-[length:var(--px-9)] opacity-60">
                  LRA {data.technical.loudnessRangeLu.toFixed(1)} LU · peak {data.technical.truePeakDbtp.toFixed(1)} dB · crest {data.technical.crestFactor.toFixed(1)} · avg {data.technical.averageLoudnessDb.toFixed(1)} dB
                </div>
              }
            >
              <MultiLineChart
                durationMs={durationMs}
                currentMs={currentMs}
                onSeek={seek}
                height={130}
                lines={[
                  { label: "loudness (LUFS)", series: data.technical.loudnessCurve, color: ACCENT, fmt: (v) => `${v.toFixed(1)} LUFS` },
                  { label: "rms energy", series: data.technical.rmsEnergyCurve, color: "#7fb0ff", fmt: (v) => `${(v * 100).toFixed(0)}%` },
                ]}
              />
            </Panel>

            {/* energy journey — full width */}
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
                <LineChart series={data.energy.energyCurve} height={130} />
              </TimeAxis>
            </Panel>

            {/* =============== PART 1 — local DSP (shown immediately) =============== */}
            {/* spectrum */}
            <Panel title="Spectrogram" subtitle="frequency (Hz, linear) over time · brightness = power (dB rel. peak) · click / play to seek">
              <SpectrogramView
                matrix={data.spectral.linearSpectrogram ?? data.spectral.melSpectrogram}
                linear={!!data.spectral.linearSpectrogram}
                sampleRateHz={data.identity.sampleRateHz}
                durationMs={durationMs}
                currentMs={currentMs}
                onSeek={seek}
                height={190}
              />
            </Panel>

            {/* harmony — Camelot wheel */}
            <Panel title="Harmony" subtitle={data.tonality.key == null ? "analyzing key…" : `${data.tonality.key} ${data.tonality.scale} · ${(data.tonality.strength * 100).toFixed(0)}% strength`}>
              {data.tonality.key == null ? (
                <div className="flex items-center justify-center gap-[var(--px-8)] font-helvetica text-[length:var(--px-11)] opacity-60" style={{ minHeight: 160 }}>
                  <Spinner size={16} /> analyzing…
                </div>
              ) : (
                <div className="flex justify-center">
                  <CamelotWheel camelot={data.tonality.camelot ?? ""} />
                </div>
              )}
            </Panel>

            {/* chromagram — its own full-width track */}
            <Panel
              title="Chromagram"
              subtitle={
                data.tonality.chromagram.data.length === 0
                  ? "pitch-class energy over time (Essentia HPCP) · analyzing…"
                  : "pitch-class energy over time (Essentia HPCP) · hover for the notes · click / play to seek"
              }
            >
              {data.tonality.chromagram.data.length === 0 ? (
                <div className="flex items-center justify-center gap-[var(--px-8)] rounded-[var(--px-8)] bg-[var(--opacity-10)] font-helvetica text-[length:var(--px-11)] opacity-60" style={{ height: 170 }}>
                  <Spinner size={16} /> analyzing…
                </div>
              ) : (
                <ChromaView matrix={data.tonality.chromagram} durationMs={durationMs} currentMs={currentMs} onSeek={seek} height={170} />
              )}
            </Panel>

            {/* timbre */}
            <Panel title="Timbre over time" subtitle="spectral centroid · rolloff · bandwidth · flatness · zero-crossing rate · toggle lines below">
              <MultiLineChart
                height={120}
                durationMs={durationMs}
                currentMs={currentMs}
                onSeek={seek}
                lines={[
                  { label: "centroid", series: data.spectral.centroidCurve, color: ACCENT, fmt: (v) => `${(v / 1000).toFixed(2)} kHz` },
                  { label: "rolloff", series: data.spectral.rolloffCurve, color: "#7fb0ff", fmt: (v) => `${(v / 1000).toFixed(2)} kHz` },
                  ...(data.spectral.bandwidthCurve.values.length
                    ? [{ label: "bandwidth", series: data.spectral.bandwidthCurve, color: "#e0b46a", fmt: (v: number) => `${(v / 1000).toFixed(2)} kHz` }]
                    : []),
                  { label: "flatness", series: data.spectral.flatnessCurve, color: "#8fd694", fmt: (v) => `${(v * 100).toFixed(1)}%` },
                  ...(data.spectral.zcrCurve.values.length
                    ? [{ label: "zcr", series: data.spectral.zcrCurve, color: "#c88fe0", fmt: (v: number) => `${(v * 100).toFixed(1)}%` }]
                    : []),
                ]}
              />
            </Panel>

            {/* =============== PART 2 — semantic / GPU (fills in below) =============== */}
            {part2Done ? (
              <>
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
                <Panel title="Composition (stems)" subtitle="Demucs source separation — stacked stem energy over time · click / play to seek">
                  <div className="grid grid-cols-1 items-center gap-[var(--px-16)] lg:grid-cols-[1fr_auto]">
                    <StemArea stems={data.composition.stems} hidden={stemsHidden} onToggle={toggleStem} durationMs={durationMs} currentMs={currentMs} onSeek={seek} vocalRegions={data.composition.vocalRegions} />
                    <Donut stems={data.composition.stems} hidden={stemsHidden} />
                  </div>
                </Panel>

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
                    <div className="grid grid-cols-3 gap-x-[var(--px-10)] gap-y-[var(--px-14)] sm:grid-cols-6">
                      <Gauge value={data.semantics.danceability} label="Danceable" hint="How suitable for dancing (steady beat, groove) — Discogs classifier." />
                      <Gauge value={data.semantics.approachability} label="Approachable" hint="How accessible / easy-listening vs. challenging the track sounds." />
                      <Gauge value={data.semantics.voiceScore} label="Vocal" sub={data.semantics.voiceInstrumental} hint="Likelihood the track contains vocals vs. being instrumental." />
                      <Gauge value={data.semantics.timbreBright} label="Bright" sub="vs dark" hint="Timbre brightness — bright/airy vs. dark/warm spectral balance." />
                      <Gauge value={data.semantics.moodElectronic} label="Electronic" hint="Electronic vs. acoustic production character." />
                      <Gauge value={data.semantics.moodAcoustic} label="Acoustic" hint="Acoustic-instrument character of the track." />
                    </div>
                  </div>
                </Panel>

                {/* genre / style */}
                <div className="grid grid-cols-1 gap-[var(--px-20)] lg:grid-cols-2">
                  <Panel title="Genre" subtitle="Discogs-400 (MAEST) · top 7">
                    <BarList items={data.semantics.genreTop.slice(0, 7)} labelTransform={shortGenre} />
                  </Panel>
                  <Panel title="Detailed style" subtitle="MAEST-519 · top 7">
                    <BarList items={data.semantics.styleMaestTop.slice(0, 7)} labelTransform={shortGenre} />
                  </Panel>
                </div>

                {/* mood / theme — full width, centered title, single row of chips */}
                <Panel title="Mood / theme" subtitle="MTG-Jamendo tags" center>
                  <TagChips items={data.semantics.moodThemeTop} singleLine />
                </Panel>
              </>
            ) : (
              <Panel title="Sound, mood & style" subtitle="genre · instruments · stems · emotion" center>
                <div className="flex justify-center py-[var(--px-14)]">
                  <div className="flex flex-col gap-[var(--px-16)]">
                    <LoadingStep title="Sound & structure" subtitle="tempo · key · loudness · spectrum · sections — ready above" done />
                    <LoadingStep title="Sound, mood & style" subtitle="genre · instruments · stems · emotion — running the models" />
                  </div>
                </div>
              </Panel>
            )}

            <p className="text-center font-helvetica text-[length:var(--px-9)] opacity-30">
              measured (tempo · key · loudness) vs predicted (genre · mood · instruments)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
