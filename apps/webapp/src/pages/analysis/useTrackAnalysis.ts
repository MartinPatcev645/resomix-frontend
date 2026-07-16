/**
 * useTrackAnalysis — upload → analyze → result state machine.
 *
 * Default (prod): routes through **Alwyzon** (the single upload front-door), so the upload is
 * login-only and counts against `uploads_per_month`, and every upload also yields a similarity
 * playlist (generated as a background sibling). Alwyzon foregrounds the analysis on the
 * resomix-analysis-service and proxies status/result back:
 *   POST /api/v1/analysis/upload         -> { analysis_id, track_uuid }
 *   GET  /api/v1/analysis/{id}/status    -> { state, part1_ready, progress:{percent}, error }
 *   GET  /api/v1/analysis/{id}/result    -> canonical analysis JSON (partial then full)
 *
 * Dev fallback (VITE_ANALYSIS_VIA_ALWYZON=false): talks DIRECTLY to the analysis service
 * (`VITE_ANALYSIS_ENDPOINT`) — only usable when that service has no internal key set.
 *
 * Part 1 (fast local DSP) renders as soon as the backend checkpoints it; the semantic/GPU part 2
 * fills in when the full result lands (progressive delivery). The snake_case canonical result is
 * adapted to the camelCase `AnalysisData` the dashboard renders via `mapCanonicalToAnalysisData`.
 */

import { useCallback, useRef, useState } from "react";
import {
  uploadForAnalysis,
  getAnalysisStatus,
  getAnalysisResult,
  mintAnalysisToken,
} from "@resomix/api-client";
import type { AnalysisData } from "./data.js";
import { mapCanonicalToAnalysisData } from "./mapCanonical.js";
import { makePlayableUrl } from "./audioPlayable.js";

/** resomix-analysis-service (FastAPI) public base URL. Used by the dev-direct fallback AND by the
 *  direct-from-cache result fetch below (the served cache lives on the analysis service). */
export const ANALYSIS_ENDPOINT =
  import.meta.env.VITE_ANALYSIS_ENDPOINT ?? "http://localhost:8010";

/** Route uploads through Alwyzon (default). Set VITE_ANALYSIS_VIA_ALWYZON=false for dev-direct. */
const VIA_ALWYZON = (import.meta.env.VITE_ANALYSIS_VIA_ALWYZON ?? "true") !== "false";

/** Fetch the completed result DIRECTLY from the served cache via an Alwyzon-minted token, so the
 *  heavy JSON bypasses Alwyzon's proxy. Default on; set VITE_ANALYSIS_DIRECT_CACHE=false to disable.
 *  Always falls back to the proxy on any failure (e.g. token IP-lock mismatch behind a proxy). */
const DIRECT_CACHE = (import.meta.env.VITE_ANALYSIS_DIRECT_CACHE ?? "true") !== "false";

// Poll with a gentle backoff: quick at first (part 1 lands in a few seconds), then slower while
// the GPU part 2 runs (often 1-2 min). Halves the request volume vs a fixed 1.5s interval — which
// matters at scale (each concurrent analysis is its own polling client through Alwyzon).
const POLL_INTERVAL_START_MS = 1500;
const POLL_INTERVAL_MAX_MS = 5000;
const POLL_INTERVAL_STEP_MS = 500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // give a full-track analysis up to 10 minutes

export type AnalysisStatus = "idle" | "uploading" | "analyzing" | "done" | "error";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Normalized status document shared by both transports. */
interface StatusDoc {
  state?: string;
  part1_ready?: boolean;
  percent: number;
  error?: string;
  // Alwyzon enriches status/result with the uploaded track's uuid and its sibling similarity
  // playlist's uuid (owner-gated). The analysis screen plays the upload over HLS by reusing that
  // playlist's seed-only manifest. Absent on the dev-direct transport (the analysis service doesn't
  // know either id) and until the async sibling playlist exists.
  track_uuid?: string;
  playlist_uuid?: string;
}
type StatusFetcher = (id: string) => Promise<StatusDoc>;
type ResultFetcher = (id: string) => Promise<unknown>;

async function errText(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json();
    return (j?.detail as string) || (j?.error as string) || `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

/**
 * POST the file with a REAL upload-progress callback via XHR (dev-direct path only).
 * Resolves with the parsed JSON body (or rejects with the server's error detail).
 */
function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<{ analysis_id?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => onProgress(100);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response ?? {});
      } else {
        const body = xhr.response as { detail?: string; error?: string } | null;
        reject(new Error(body?.detail || body?.error || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed (network error)"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(form);
  });
}

// --- transport-specific fetchers ------------------------------------------- //

const directStatus: StatusFetcher = async (id) => {
  const res = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}`);
  if (res.status === 404) throw new Error("Analysis not found");
  if (!res.ok) throw new Error(await errText(res, "Status check failed"));
  const st = (await res.json()) as StatusDoc & { progress?: { percent?: number } };
  return {
    state: st.state, part1_ready: st.part1_ready, percent: st.progress?.percent ?? 0, error: st.error,
    track_uuid: st.track_uuid, playlist_uuid: st.playlist_uuid,
  };
};
const directResult: ResultFetcher = async (id) => {
  const res = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}/result`);
  if (!res.ok) throw new Error(await errText(res, "Result fetch failed"));
  return res.json();
};

const alwyzonStatus: StatusFetcher = async (id) => {
  const res = await getAnalysisStatus(id);
  if (!res || (res as { success?: boolean }).success === false) {
    throw new Error((res as { error?: string })?.error || "Status check failed");
  }
  const d = (res as { data: { state?: string; part1_ready?: boolean; progress?: { percent?: number }; error?: string; track_uuid?: string; playlist_uuid?: string } }).data;
  return {
    state: d.state, part1_ready: d.part1_ready, percent: d.progress?.percent ?? 0, error: d.error,
    track_uuid: d.track_uuid, playlist_uuid: d.playlist_uuid,
  };
};
const alwyzonResult: ResultFetcher = async (id) => {
  const res = await getAnalysisResult(id);
  if (!res || (res as { success?: boolean }).success === false) {
    throw new Error((res as { error?: string })?.error || "Result fetch failed");
  }
  return (res as { data: unknown }).data;
};

/** Direct-from-served-cache fetch of the FULL result: mint a token via Alwyzon, then GET the JSON
 *  straight from the analysis service (bypasses Alwyzon's proxy for the heavy payload). */
const fetchResultFromCache: ResultFetcher = async (id) => {
  const tok = await mintAnalysisToken(id);
  if (!tok || (tok as { success?: boolean }).success === false) {
    throw new Error((tok as { error?: string })?.error || "Token mint failed");
  }
  const { token, retrieval_path } = (tok as { data: { token: string; retrieval_path: string } }).data;
  const res = await fetch(`${ANALYSIS_ENDPOINT}${retrieval_path}?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`Cache fetch failed (${res.status})`);
  return res.json();
};

/** The FINAL (completed) result fetcher for the Alwyzon transport: prefer the served cache, fall
 *  back to the proxy on any failure so a misconfigured cache path can never break the flow. */
const alwyzonFinalResult: ResultFetcher = async (id) => {
  if (DIRECT_CACHE) {
    try {
      return await fetchResultFromCache(id);
    } catch {
      /* fall back to the Alwyzon proxy below */
    }
  }
  return alwyzonResult(id);
};

/**
 * Poll a job to completion: surface part-1 as soon as it's ready, then the full result. Shared
 * by a fresh upload and by loading an existing id from the URL, over either transport.
 */
async function pollAnalysis(
  id: string,
  isLive: () => boolean,
  onProgress: (pct: number) => void,
  onResult: (data: AnalysisData, done: boolean) => void,
  fetchStatus: StatusFetcher,
  fetchResult: ResultFetcher,
  fetchFinal: ResultFetcher = fetchResult,
  onMeta: (meta: { trackUuid?: string; playlistUuid?: string }) => void = () => {},
): Promise<void> {
  const startedAt = Date.now();
  let part1Shown = false;
  let interval = POLL_INTERVAL_START_MS;
  for (;;) {
    if (!isLive()) return;
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) throw new Error("Analysis timed out");
    const st = await fetchStatus(id);
    // Surface the upload's track uuid + its sibling playlist uuid as soon as they appear (the
    // playlist is created async, so it may land on a later poll). Drives the HLS playback wiring.
    if (st.track_uuid || st.playlist_uuid) {
      onMeta({ trackUuid: st.track_uuid, playlistUuid: st.playlist_uuid });
    }
    onProgress(Math.min(95, Math.max(10, st.percent)));

    // Stream the interim part-1 result early — BUT skip it when the job is already complete on this
    // very poll (e.g. opening an existing/finished analysis via ?id= or the library). In that case
    // the single final fetch below returns the whole thing, so fetching here too would download the
    // heavy result JSON twice. Fresh uploads still get part-1 early because `part1_ready` lands while
    // the job is still running (state !== "succeeded").
    if (st.part1_ready && !part1Shown && st.state !== "succeeded") {
      part1Shown = true;
      try {
        const raw = await fetchResult(id); // part-1 (partial) via the proxy
        if (!isLive()) return;
        onResult(mapCanonicalToAnalysisData(raw), false);
      } catch {
        /* part-1 not fetchable yet — keep polling */
      }
    }
    if (st.state === "succeeded") break;
    if (st.state === "failed") throw new Error(st.error || "Analysis failed on the server");
    await delay(interval);
    interval = Math.min(interval + POLL_INTERVAL_STEP_MS, POLL_INTERVAL_MAX_MS);
  }

  const raw = await fetchFinal(id); // full result — prefer the served cache
  if (!isLive()) return;
  onResult(mapCanonicalToAnalysisData(raw), true);
}

export function useTrackAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [part1Ready, setPart1Ready] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [trackUuid, setTrackUuid] = useState<string | null>(null);
  const [playlistUuid, setPlaylistUuid] = useState<string | null>(null);

  const runId = useRef(0);
  const audioUrlRef = useRef<string | null>(null);

  const setTrackUrl = useCallback((url: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setTrackUrl(null);
    setStatus("idle");
    setData(null);
    setError(null);
    setProgress(0);
    setPart1Ready(false);
    setFileName(null);
    setAnalysisId(null);
    setTrackUuid(null);
    setPlaylistUuid(null);
  }, [setTrackUrl]);

  const analyze = useCallback(async (file: File) => {
    const myRun = ++runId.current;
    const live = (fn: () => void) => {
      if (runId.current === myRun) fn();
    };

    setFileName(file.name);
    void makePlayableUrl(file).then((url) => live(() => setTrackUrl(url)));
    setError(null);
    setData(null);
    setProgress(0);
    setPart1Ready(false);
    setTrackUuid(null);
    setPlaylistUuid(null);

    try {
      // 1) upload -> enqueue (real byte-level upload progress)
      live(() => setStatus("uploading"));
      live(() => setProgress(0));

      let id: string | undefined;
      if (VIA_ALWYZON) {
        const up = await uploadForAnalysis(file, (pct) => live(() => setProgress(pct)));
        if (!up || (up as { success?: boolean }).success === false) {
          const reason = (up as { reason?: string })?.reason;
          const serverMsg = (up as { error?: string })?.error;
          const msg =
            reason === "login_required"
              ? "Please log in to analyze a track."
              : reason === "upgrade_required"
                ? serverMsg || "You've used all your uploads this month. Upgrade to analyze more."
                : serverMsg || "Upload failed";
          throw new Error(msg);
        }
        id = (up as { data: { analysis_id?: string } }).data.analysis_id;
      } else {
        const form = new FormData();
        form.append("file", file);
        const created = await uploadWithProgress(
          `${ANALYSIS_ENDPOINT}/v1/analyses`,
          form,
          (pct) => live(() => setProgress(pct)),
        );
        id = created.analysis_id;
      }
      if (!id) throw new Error("Server did not return an analysis id");
      live(() => setAnalysisId(id)); // -> the page mirrors this into ?id=

      // 2) poll to completion; render part 1 (local DSP) as soon as it's ready.
      live(() => setStatus("analyzing"));
      await pollAnalysis(
        id,
        () => runId.current === myRun,
        (pct) => live(() => setProgress(pct)),
        (d, done) =>
          live(() => {
            setData(d);
            if (done) {
              setProgress(100);
              setStatus("done");
            } else {
              setPart1Ready(true);
            }
          }),
        VIA_ALWYZON ? alwyzonStatus : directStatus,
        VIA_ALWYZON ? alwyzonResult : directResult,
        VIA_ALWYZON ? alwyzonFinalResult : directResult,
        (meta) => live(() => {
          if (meta.trackUuid) setTrackUuid(meta.trackUuid);
          if (meta.playlistUuid) setPlaylistUuid(meta.playlistUuid);
        }),
      );
    } catch (e) {
      live(() => setError(e instanceof Error ? e.message : "Analysis failed"));
      live(() => setStatus("error"));
    }
  }, [setTrackUrl]);

  // Open an existing analysis by id (refresh / shared ?id= link).
  const loadById = useCallback(async (id: string) => {
    const myRun = ++runId.current;
    const live = (fn: () => void) => {
      if (runId.current === myRun) fn();
    };

    live(() => {
      setTrackUrl(null);
      setError(null);
      setData(null);
      setProgress(10);
      setPart1Ready(false);
      setAnalysisId(id);
      setStatus("analyzing");
      setTrackUuid(null);
      setPlaylistUuid(null);
    });

    try {
      await pollAnalysis(
        id,
        () => runId.current === myRun,
        (pct) => live(() => setProgress(pct)),
        (d, done) =>
          live(() => {
            setData(d);
            setFileName(d.identity.filename ?? null);
            if (done) {
              setProgress(100);
              setStatus("done");
            } else {
              setPart1Ready(true);
            }
          }),
        VIA_ALWYZON ? alwyzonStatus : directStatus,
        VIA_ALWYZON ? alwyzonResult : directResult,
        VIA_ALWYZON ? alwyzonFinalResult : directResult,
        (meta) => live(() => {
          if (meta.trackUuid) setTrackUuid(meta.trackUuid);
          if (meta.playlistUuid) setPlaylistUuid(meta.playlistUuid);
        }),
      );
    } catch (e) {
      live(() => setError(e instanceof Error ? e.message : "Could not load analysis"));
      live(() => setStatus("error"));
    }
  }, [setTrackUrl]);

  return { status, data, error, progress, fileName, audioUrl, part1Ready, analysisId, trackUuid, playlistUuid, analyze, loadById, reset };
}
