/**
 * AnalysisPage — track upload + full "anatomy" dashboard.
 *
 * TESTING PHASE: the data is the hardcoded sample from `useTrackAnalysis`
 * (a real analysis of "Ibiza Afrodeep — Original Mix"). Uploading a track runs
 * the simulated job flow and then renders every panel. Wiring to the live
 * resomix-analysis-service happens later (see useTrackAnalysis.ts).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { attachHls, shortGenre } from "@resomix/hooks";
import { getPlaylistPlaybackSession } from "@resomix/api-client";
import { useTrackAnalysis } from "./analysis/useTrackAnalysis.js";
import { useRecentAnalyses } from "./analysis/useRecentAnalyses.js";
import { AnalysisIntro } from "./analysis/AnalysisIntro.js";
import { FullAnalysisLocked } from "@/components/Entitlements/FullAnalysisLocked.tsx";
import { ACCENT, BarList, fmtClock, Gauge, LineChart, LoadingStep, MoodMap, MultiLineChart, Panel, Spinner, StatCard, TagChips, TimeAxis, TipRows, useToggleSet, valueAt } from "./analysis/charts.js";
// `sectionAt` and `StructureTimeline` are still exported from heatviz; they are unimported
// here only while the Structure panel below is disabled.
import { CamelotWheel, chromaLabelsForKey, ChromaSummary, ChromaView, Donut, keyFromCamelot, MoodRadar, RibbonChart, SpectrogramView, StemArea, WaveTimeline } from "./analysis/heatviz.js";

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
  const { status, data, error, progress, fileName, audioUrl, part1Ready, analysisId, playlistUuid, analyze, loadById, reset } = useTrackAnalysis();
  // Recent analyses (logged-in user) to preview on the otherwise-empty landing; only fetched idle.
  const { items: recentAnalyses } = useRecentAnalyses(status === "idle");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Capture the origin ONCE at mount: the effect below rewrites the URL via
  // setSearchParams({ replace: true }), which drops location.state — so reading it later would
  // always look like a non-library visit and mislabel the back button.
  const [cameFromLibrary] = useState(() => location.state?.from === "library");
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Stop the local <audio> when leaving the page so it never keeps playing in the background
  // (belt-and-suspenders: the element also unmounts, but an explicit pause is immediate). Read the
  // ref inside cleanup so we get the live element at unmount, not null captured at mount.
  useEffect(() => {
    return () => { try { audioRef.current?.pause(); } catch { /* noop */ } };
  }, []);
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

  // The <audio> element is only mounted once the dashboard renders (it needs `data`). On a refresh /
  // library open, `playlistUuid` typically arrives from the status poll BEFORE the result renders,
  // so the HLS-attach effect must ALSO re-run when the player mounts — otherwise it fires once with
  // a null `audioRef.current` and never retries. This boolean flips false→true exactly when the
  // <audio> appears.
  const playerMounted = !!(data && (part1Ready || status === "done"));

  // Server-side playback for the uploaded track when there's no local blob (opened from the
  // library, a shared/refreshed ?id= link, or after a page reload): reuse the upload's sibling
  // similarity playlist's seed-only HLS manifest — the same media-server segments the playlist
  // page streams — and attach hls.js to this same <audio>. Fresh uploads keep the instant local
  // blob (audioUrl) and skip this; if there's no sibling playlist yet, playback stays silent.
  useEffect(() => {
    if (audioUrl) return;                 // fresh upload → native blob src already plays it
    const a = audioRef.current;
    if (!a || !playlistUuid) return;      // player not mounted yet, or no sibling playlist → wait
    let detach: (() => void) | null = null;
    let cancelled = false;
    // The sibling playlist's HLS can lag its creation by a moment (segments still being cut), and a
    // playback-session mint can blip — so retry a few times with backoff before giving up. attachHls
    // then handles per-stream network/media recovery. If everything's exhausted, stay silent (no
    // dead-player crash) — the panels/result still render.
    void (async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const { playback_url } = await getPlaylistPlaybackSession(playlistUuid);
          if (cancelled || !audioRef.current) return;
          detach = attachHls(audioRef.current, playback_url, () => {
            /* stream unrecoverable (expired/missing) — leave the player silent */
          });
          return; // session obtained → done
        } catch {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); // 1s, 2s, 3s…
        }
      }
    })();
    return () => { cancelled = true; if (detach) detach(); };
  }, [audioUrl, playlistUuid, playerMounted]);

  // Stem show/hide selection, shared by the stacked area + the donut.
  const stemNames = data ? Object.keys(data.composition.stems) : [];
  const { hidden: stemsHidden, toggle: toggleStem } = useToggleSet(stemNames.length);

  // Canonical, MIK-correct key label derived from the Camelot code (single source of truth for the
  // Key stat + Harmony subtitle, always matching the wheel — never the sharp-normalized raw key).
  const keyLabel = data ? keyFromCamelot(data.tonality.camelot) : null;
  // Secondary key candidate (from the numpy cross-check) — shown only when the detection is flagged
  // ambiguous, spelled through the same Camelot source so it reads consistently (e.g. "6B · Bb major").
  const altLabel = data ? keyFromCamelot(data.tonality.altCamelot) : null;

  // Only the (currently disabled) Structure panel read this. Restore it with the panel.
  // const activeSection = data?.energy.structureSegments.find(
  //   (s) => currentMs >= s.startMs && currentMs < s.endMs,
  // );

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

  // The server withheld the dashboard sections because this plan lacks `can_view_full_analysis`
  // (pricing v2.1 §1.6). The data is genuinely absent, so the panels below cannot render — show
  // the upgrade CTA instead of charts drawn over nothing.
  const fullAnalysisLocked = !!data?.fullAnalysisLocked;

  // Progressive delivery: show the dashboard as soon as part 1 (local DSP) is in;
  // the part-2 (semantic/GPU) panels fill in below once the full result lands.
  const showDashboard = (part1Ready || status === "done") && data && !fullAnalysisLocked;
  const part2Done = status === "done";

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-[var(--px-56)] lg:px-[var(--px-80)] pb-[var(--px-80)] tracking-[var(--px-1)]">
      <div className="mx-auto w-full max-w-6xl text-[var(--color-primary)]">
        {/* Back nav — return to wherever the user came from: Library when the analysis was opened
            from a track, otherwise the upload landing. Mirrors the playlist page's back link. */}
        <div className="mb-[var(--px-16)]">
          <button
            type="button"
            onClick={() => navigate(cameFromLibrary ? "/library" : "/")}
            aria-label={cameFromLibrary ? "Back to Library" : "Back to Upload"}
            className="inline-flex items-center gap-[var(--px-8)] text-[length:var(--px-10)] font-light font-fira uppercase tracking-wide opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <svg className="w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-current" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {cameFromLibrary ? "Back to Library" : "Back to Upload"}
          </button>
        </div>

        <header className="mb-[var(--px-28)] text-center">
          {/* Base size is the shared webapp mobile hero size (--px-28/--px-32, same as
              AuthScreen / LibraryPage / WorkspaceShell) — please don't set a bespoke value here.
              md: restores the original desktop 52/60, which is unchanged. */}
          <h1 className="font-helvetica text-[length:var(--px-28)] leading-[var(--px-32)] font-medium uppercase break-words md:text-[length:var(--px-52)] md:leading-[var(--px-60)]">
            Analysis
          </h1>
          <p className="mt-[var(--px-8)] font-helvetica text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80">
            Upload a track to see what it's actually made of
          </p>
        </header>

        {/* --------------------------------------------- Full analysis is Pro */}
        {fullAnalysisLocked && status !== "error" && (
          <FullAnalysisLocked
            onBack={() =>
              // Back to the SUMMARY for this analysis — what the caller is entitled to and what
              // they were looking at. Sending them to the upload landing lost their place.
              navigate(analysisId ? `/analysis?id=${analysisId}` : cameFromLibrary ? "/library" : "/analysis")
            }
          />
        )}

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
                "flex w-full flex-col items-center gap-[var(--px-12)] rounded-[var(--px-16)] border border-dotted " +
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

        {/* ----------------------------- Landing: recent-analysis pills + facts */}
        {status === "idle" && (
          <AnalysisIntro items={recentAnalyses} onOpen={(id) => void loadById(id)} />
        )}

        {/* ------------------------------------------ Part-1 computing (loader) */}
        {status === "analyzing" && !part1Ready && (
          <div className="mx-auto w-full max-w-2xl">
            <div className="rounded-[var(--px-16)] border border-[var(--opacity-15)] bg-[var(--opacity-10)] p-[var(--px-32)]">
              <div className="mb-[var(--px-16)] truncate font-helvetica text-[length:var(--px-12)] uppercase tracking-[var(--px-1)] opacity-70">
                Analyzing · {fileName}
              </div>
              <div className="flex flex-col gap-[var(--px-16)]">
                {/* "sections" dropped from both subtitles while the Structure panel is off. */}
                <LoadingStep title="Sound & dynamics" subtitle="tempo · key · loudness · spectrum" />
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
                value={data.tonality.key == null ? <Spinner size={20} /> : keyLabel ? `${keyLabel.name} ${keyLabel.scale === "major" ? "maj" : "min"}` : "—"}
                sub={data.tonality.key == null ? "analyzing…" : `Camelot ${data.tonality.camelot}`}
                hint="Estimated musical key & scale (Essentia EDMA profile, tuned for electronic music), plus its Camelot code for harmonic mixing."
              />
              <StatCard label="Loudness" value={data.technical.integratedLufs.toFixed(1)} sub="LUFS integrated" hint="Integrated loudness in LUFS (EBU R128), the overall perceived level across the whole track." />
              <StatCard label="Duration" value={fmtDuration(data.identity.durationMs)} sub={data.rhythm.bpm == null ? "— BPM" : `${fmtBpm(data.rhythm.bpm)} BPM`} hint="Total track length (mm:ss)." />
              {data.semantics.genreTop.length > 0 ? (
                <StatCard label="Top genre" value={<span className="text-[length:var(--px-16)]">{shortGenre(data.semantics.genreTop[0].label)}</span>} sub={`${(data.semantics.genreTop[0].score * 100).toFixed(0)}% match`} hint="Most likely genre from the Discogs-400 model (MAEST-30s). See the full ranking below." />
              ) : (
                <StatCard label="Top genre" value={<Spinner size={20} />} sub="analyzing…" hint="Genre needs the model pass (part 2), filling in shortly." />
              )}
            </div>

            {/* Structure panel is switched OFF while we wait for the Raveform authors to reply
                about the new approach and its label vocabulary. The backend has stopped computing
                v1 and v2, so this panel would render an empty strip with no sections. The markup
                is kept verbatim so re-enabling is a matter of uncommenting it (together with
                `activeSection` above and the `sectionAt` / `StructureTimeline` imports). See
                STRUCTURE/docs/2026-08-25-edm-structure-parked-restore-and-gpu-setup.md.

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
            */}

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
            <Panel title="Harmony" subtitle={data.tonality.key == null ? "analyzing key…" : keyLabel ? `${keyLabel.name} ${keyLabel.scale} · ${(data.tonality.strength * 100).toFixed(0)}% strength` : "—"}>
              {data.tonality.key == null ? (
                <div className="flex items-center justify-center gap-[var(--px-8)] font-helvetica text-[length:var(--px-11)] opacity-60" style={{ minHeight: 160 }}>
                  <Spinner size={16} /> analyzing…
                </div>
              ) : (
                <div className="flex flex-col items-center gap-[var(--px-8)]">
                  <CamelotWheel camelot={data.tonality.camelot ?? ""} />
                  {data.tonality.tuningHz != null && (
                    <div
                      className="text-center font-helvetica text-[length:var(--px-10)] leading-[var(--px-14)] opacity-70"
                      title="Estimated tuning of the note A (concert pitch = 440 Hz). Off-440 masters are common in vinyl-era catalogue; the chromagram is tuning-corrected before analysis so notes land in the right bins."
                    >
                      Tuning: A = {Math.round(data.tonality.tuningHz)} Hz
                      {data.tonality.tuningCents != null && ` (${data.tonality.tuningCents > 0 ? "+" : ""}${Math.round(data.tonality.tuningCents)}¢)`}
                      {data.tonality.tuningCents != null && Math.abs(data.tonality.tuningCents) > 25 && (
                        <span className="ml-[var(--px-6)] font-semibold text-[#ee4a26]">· pitched</span>
                      )}
                    </div>
                  )}
                  {data.tonality.ambiguous && altLabel && (
                    <div className="text-center font-helvetica text-[length:var(--px-10)] leading-[var(--px-14)] opacity-80">
                      ⚠ Key may be ambiguous, or possibly {altLabel.name} {altLabel.scale} ({data.tonality.altCamelot}).
                    </div>
                  )}
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
                <div className="flex flex-col gap-[var(--px-16)]">
                  <ChromaView
                    matrix={data.tonality.chromagram}
                    durationMs={durationMs}
                    currentMs={currentMs}
                    onSeek={seek}
                    height={170}
                    labels={chromaLabelsForKey(data.tonality.camelot)}
                  />
                  {/* Global note-energy summary — explains why the key won even when a non-tonic
                      (e.g. the dominant) is the loudest row, and flags genuine ambiguity. */}
                  <ChromaSummary matrix={data.tonality.chromagram} camelot={data.tonality.camelot} />
                </div>
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
                <Panel title="Evolution over time" subtitle="genre · mood · instruments across the track · brighter = stronger · click / play to seek">
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
                <Panel title="Composition (stems)" subtitle="Demucs source separation · stacked stem energy over time · click / play to seek">
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
                      <Gauge value={data.semantics.danceability} label="Danceable" hint="How suitable for dancing (steady beat, groove), from the Discogs classifier." />
                      <Gauge value={data.semantics.approachability} label="Approachable" hint="How accessible / easy-listening vs. challenging the track sounds." />
                      <Gauge value={data.semantics.voiceScore} label="Vocal" sub={data.semantics.voiceInstrumental} hint="Likelihood the track contains vocals vs. being instrumental." />
                      <Gauge value={data.semantics.timbreBright} label="Bright" sub="vs dark" hint="Timbre brightness: bright/airy vs. dark/warm spectral balance." />
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
                    <LoadingStep title="Sound & dynamics" subtitle="tempo · key · loudness · spectrum · ready above" done />
                    <LoadingStep title="Sound, mood & style" subtitle="genre · instruments · stems · emotion · running the models" />
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
