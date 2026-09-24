/**
 * AnalysisPage — track upload + full "anatomy" dashboard.
 *
 * TESTING PHASE: the data is the hardcoded sample from `useTrackAnalysis`
 * (a real analysis of "Ibiza Afrodeep — Original Mix"). Uploading a track runs
 * the simulated job flow and then renders every panel. Wiring to the live
 * resomix-analysis-service happens later (see useTrackAnalysis.ts).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { attachHls, shortGenre, useResponsive } from "@resomix/hooks";
import { getPlaylistPlaybackSession } from "@resomix/api-client";
import { useTrackAnalysis } from "./analysis/useTrackAnalysis.js";
import { useRecentAnalyses } from "./analysis/useRecentAnalyses.js";
import { AnalysisIntro } from "./analysis/AnalysisIntro.js";
import { FullAnalysisLocked } from "@/components/Entitlements/FullAnalysisLocked.tsx";
import { ACCENT, LoadingStep, Spinner, StatCard } from "./analysis/charts.js";
import { WORKSPACE_BTN_SECONDARY } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";
import { keyFromCamelot } from "./analysis/heatviz.js";
// The redesigned dashboard (handoff: four tabs, one shared timeline). By path, like StructurePanel
// above: App.tsx loads the `@/components` barrel eagerly, and these pull in the chart modules this
// lazily-loaded page keeps out of the main bundle.
import { AnalysisTabs, isAnalysisTab, type AnalysisTab } from "@/components/Analysis/AnalysisTabs.tsx";
import { AnalysisStickyPlayer } from "@/components/Analysis/AnalysisStickyPlayer.tsx";
import { TimelineTab } from "@/components/Analysis/timeline/TimelineTab.tsx";
import { HarmonyTab } from "@/components/Analysis/HarmonyTab.tsx";
import { VibeTab } from "@/components/Analysis/VibeTab.tsx";
import { GenreTab } from "@/components/Analysis/GenreTab.tsx";
import { TabPending } from "@/components/Analysis/TabPending.tsx";

const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
// Live BPM is a float (e.g. 123.0 or 128.4); show whole numbers cleanly.
const fmtBpm = (b: number) => (Number.isInteger(b) ? String(b) : b.toFixed(1));

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

  const durationMs = data?.identity.durationMs ?? 0;
  // One mount per breakpoint, like WebSideLines: the tab bar, the lane heights and the ruler
  // density all differ between phone and desktop, and rendering both trees would mean two
  // playheads and two canvases for every lane.
  const { isDesktop } = useResponsive();

  /**
   * Which view is open, held in the URL rather than in state so a shared `/analysis/full?id=…`
   * link can point at the tab it was read on. An unknown value falls back to Timeline instead of
   * rendering nothing.
   */
  const tabParam = searchParams.get("tab");
  const tab: AnalysisTab = isAnalysisTab(tabParam) ? tabParam : "timeline";
  const tabsRef = useRef<HTMLDivElement>(null);
  const setTab = useCallback(
    (next: AnalysisTab) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("tab", next);
          return params;
        },
        { replace: true },
      );
      // Bring the tab bar back into view when the reader is below it. Without this, switching
      // from the bottom of a long tab (the Genre footer's link to Timeline) dropped them at the
      // bottom of the next one. Only scrolls when the bar is actually off the top, so choosing a
      // tab while already at the top does not jump.
      requestAnimationFrame(() => {
        const el = tabsRef.current;
        if (!el) return;
        if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [setSearchParams],
  );

  /** Halves the Timeline lane heights for short viewports. Desktop only; the phone is already compact. */
  const [compact, setCompact] = useState(false);


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

  // Canonical, MIK-correct key label derived from the Camelot code (single source of truth for the
  // Key stat + Harmony subtitle, always matching the wheel — never the sharp-normalized raw key).
  const keyLabel = data ? keyFromCamelot(data.tonality.camelot) : null;
  /** "228 bars · 9 sections" for the Length card, once the arrangement has been read. */
  /**
   * The genre reading for the stat card. The Genre & Sonic Style tab lists genre first and sonic
   * style second, so the card shows the same list the tab calls Genre, falling back to the other
   * when only that one has landed.
   */
  const topGenre = data?.semantics.styleMaestTop?.length
    ? data.semantics.styleMaestTop
    : (data?.semantics.genreTop ?? []);

  const barsAndSections = useMemo(() => {
    const segments = data?.energy.structureSegments ?? [];
    const sections = segments.filter((seg) => !seg.hidden).length;
    const bars = segments.reduce((sum, seg) => sum + (seg.bars ?? 0), 0);
    if (!sections) return null;
    return `${bars ? `${bars} bars · ` : ""}${sections} section${sections === 1 ? "" : "s"}`;
  }, [data]);

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
    <section className="pt-[var(--px-16)] lg:pt-[var(--px-24)] px-[var(--px-20)] md:px-[var(--px-56)] lg:px-[var(--px-80)] pb-[var(--px-80)] tracking-[var(--px-1)]">
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
                // A dashed 2px edge, not a 1px dotted one at 30%: the drop target has to look like
                // a target before anything has been uploaded, and at 1px it read as background.
                "flex w-full flex-col items-center gap-[var(--px-12)] rounded-[var(--px-16)] border-2 border-dashed " +
                "p-[var(--px-56)] text-center transition-colors " +
                (dragOver ? "bg-[var(--opacity-15)]" : "bg-[var(--opacity-10)]") +
                " " +
                (status === "idle" ? "cursor-pointer hover:bg-[var(--opacity-15)]" : "cursor-default")
              }
              style={{ borderColor: dragOver ? ACCENT : "var(--rx-color-border-strong, rgba(255,255,255,0.45))" }}
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
                <LoadingStep title="Sound & dynamics" subtitle="tempo · key · loudness · spectrum" />
                {/* Structure is computed with the stems on the GPU, so it belongs to this step. */}
                <LoadingStep title="Sound, mood & style" subtitle="genre · instruments · stems · sections · emotion" />
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
                className={WORKSPACE_BTN_SECONDARY}
              >
                Analyze another
              </button>
            </div>

            {/* Transport. The element stays hidden and the sticky player drives it, so there is
                one set of controls on the page instead of the browser's and ours. */}
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

            <AnalysisStickyPlayer
              data={data}
              durationMs={durationMs}
              currentMs={currentMs}
              playing={playing}
              volume={volume}
              onTogglePlay={togglePlay}
              onSeek={seek}
              onVolume={setVolume}
              isDesktop={isDesktop}
            />

            {/* Stat cards. One row on desktop, two columns on a phone with Genre across the
                bottom. The handoff's sideways-scrolling row was worse in practice: the last cards
                sat off-screen with nothing to say so, and the row held its scroll position while
                the rest of the page moved. Nothing here scrolls horizontally now. */}
            <div className="grid grid-cols-2 gap-[var(--px-12)] lg:grid-cols-5">
              <div>
                <StatCard
                  label="Tempo"
                  value={data.rhythm.bpm == null ? <Spinner size={20} /> : fmtBpm(data.rhythm.bpm)}
                  unit={data.rhythm.bpm == null ? undefined : "BPM"}
                  sub={data.rhythm.bpm == null ? "analyzing…" : `${data.rhythm.beatCount} beats`}
                  hint="Tempo in beats per minute, measured from the pulse of the track itself."
                />
              </div>
              <div>
                <StatCard
                  label="Key"
                  value={data.tonality.key == null ? <Spinner size={20} /> : keyLabel ? `${keyLabel.name} ${keyLabel.scale === "major" ? "maj" : "min"}` : "—"}
                  unit={data.tonality.camelot ?? undefined}
                  sub={data.tonality.key == null ? "analyzing…" : `${(data.tonality.strength * 100).toFixed(0)}% strength`}
                  hint="Estimated musical key and scale, tuned for electronic music, with its Camelot code for harmonic mixing."
                />
              </div>
              <div>
                <StatCard
                  label="Loudness"
                  value={data.technical.integratedLufs.toFixed(1)}
                  unit="LUFS"
                  sub={`LRA ${data.technical.loudnessRangeLu.toFixed(1)} LU · peak ${data.technical.truePeakDbtp.toFixed(1)} dB`}
                  hint="Integrated loudness in LUFS (EBU R128), the overall perceived level across the whole track."
                />
              </div>
              <div>
                <StatCard
                  label="Length"
                  value={fmtDuration(data.identity.durationMs)}
                  sub={barsAndSections ?? (data.rhythm.bpm == null ? "— BPM" : `${fmtBpm(data.rhythm.bpm)} BPM`)}
                  hint="Total track length (mm:ss), with the arrangement it covers."
                />
              </div>
              <div className="col-span-2 lg:col-span-1">
                {topGenre.length > 0 ? (
                  <StatCard
                    label="Genre"
                    value={<span className="text-[length:var(--px-18)]">{shortGenre(topGenre[0].label)}</span>}
                    unit={`${(topGenre[0].score * 100).toFixed(0)}%`}
                    sub={
                      topGenre[1]
                        ? `${shortGenre(topGenre[1].label)} ${(topGenre[1].score * 100).toFixed(0)}%`
                        : "top match"
                    }
                    hint="The strongest genre reading for this track. The full ranking is on the Genre and Sonic Style tab."
                  />
                ) : (
                  <StatCard label="Genre" value={<Spinner size={20} />} sub="analyzing…" hint="Genre arrives with the second half of the analysis, filling in shortly." />
                )}
              </div>
            </div>

            {/* `scroll-mt` clears the sticky player, so scrolling here never parks the tab bar
                underneath it. */}
            <div ref={tabsRef} className="scroll-mt-[var(--px-130)] lg:scroll-mt-[var(--px-150)]">
              <AnalysisTabs value={tab} onChange={setTab} showHint={isDesktop} />
            </div>

            <div id={`analysis-panel-${tab}`} role="tabpanel" aria-labelledby={`analysis-tab-${tab}`}>
              {tab === "timeline" && (
                <TimelineTab
                  data={data}
                  durationMs={durationMs}
                  currentMs={currentMs}
                  onSeek={seek}
                  isDesktop={isDesktop}
                  compact={compact}
                  onToggleCompact={() => setCompact((c) => !c)}
                  pending={!part2Done}
                />
              )}

              {tab === "harmony" &&
                (data.tonality.camelot ? (
                  <HarmonyTab data={data} />
                ) : (
                  <TabPending title="Harmony" detail="key · chromagram" pending={!part2Done} />
                ))}

              {tab === "vibe" &&
                (data.semantics.moodThemeTop.length > 0 || part2Done ? (
                  <VibeTab data={data} />
                ) : (
                  <TabPending title="Vibe" detail="emotion · perceptual profile · mood tags" pending />
                ))}

              {tab === "genre" &&
                (data.semantics.genreTop.length > 0 || data.semantics.styleMaestTop.length > 0 ? (
                  <GenreTab data={data} onOpenTimeline={() => setTab("timeline")} />
                ) : (
                  <TabPending title="Genre" detail="genre · style" pending={!part2Done} />
                ))}
            </div>

            <p className="text-center font-helvetica text-[length:var(--px-9)] opacity-30">
              measured (tempo · key · loudness) vs predicted (genre · mood · instruments)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
