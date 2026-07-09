/**
 * useTrackAnalysis — upload → analyze → result state machine.
 *
 * Talks directly to the resomix-analysis-service async job API:
 *   POST /v1/analyses            -> { analysis_id }
 *   GET  /v1/analyses/{id}       -> { state, progress:{percent}, error }   (poll)
 *   GET  /v1/analyses/{id}/result-> canonical analysis JSON (once succeeded)
 * Part 1 (fast local DSP) is rendered as soon as the backend checkpoints it; the
 * semantic/GPU part 2 fills in when the full result lands (progressive delivery).
 * The snake_case canonical result is adapted to the camelCase `AnalysisData` the
 * dashboard renders via `mapCanonicalToAnalysisData`. We deliberately do NOT use
 * `@resomix/api-client` here — this page owns its service contract.
 */

import { useCallback, useRef, useState } from "react";
import type { AnalysisData } from "./data.js";
import { mapCanonicalToAnalysisData } from "./mapCanonical.js";
import { makePlayableUrl } from "./audioPlayable.js";

/** resomix-analysis-service (FastAPI) base URL. Set VITE_ANALYSIS_ENDPOINT per
 *  environment (local dev vs deployed); falls back to the local dev server. */
export const ANALYSIS_ENDPOINT =
  import.meta.env.VITE_ANALYSIS_ENDPOINT ?? "http://localhost:8010";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // give a full-track analysis up to 10 minutes

export type AnalysisStatus = "idle" | "uploading" | "analyzing" | "done" | "error";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function errText(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json();
    return (j?.detail as string) || (j?.error as string) || `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

/**
 * POST the file with a REAL upload-progress callback. `fetch` can't report
 * request-body progress, so we use XHR: `onProgress` gets 0→100 as bytes leave
 * the browser. Resolves with the parsed JSON body (or rejects with the server's
 * error detail).
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
    xhr.upload.onload = () => onProgress(100); // bytes done; server now processing
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

/**
 * Poll a job to completion: surface part-1 as soon as it's ready, then the full
 * result. Shared by a fresh upload and by loading an existing id from the URL.
 * Checks status first (so an already-finished analysis returns immediately).
 */
async function pollAnalysis(
  id: string,
  isLive: () => boolean,
  onProgress: (pct: number) => void,
  onResult: (data: AnalysisData, done: boolean) => void,
): Promise<void> {
  const startedAt = Date.now();
  let part1Shown = false;
  for (;;) {
    if (!isLive()) return;
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) throw new Error("Analysis timed out");
    const stRes = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}`);
    if (stRes.status === 404) throw new Error("Analysis not found");
    if (!stRes.ok) throw new Error(await errText(stRes, "Status check failed"));
    const st = (await stRes.json()) as {
      state?: string;
      part1_ready?: boolean;
      progress?: { percent?: number };
      error?: string;
    };
    onProgress(Math.min(95, Math.max(10, st.progress?.percent ?? 0)));

    if (st.part1_ready && !part1Shown) {
      part1Shown = true;
      const p1 = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}/result`);
      if (p1.ok) {
        const raw = await p1.json();
        if (!isLive()) return;
        onResult(mapCanonicalToAnalysisData(raw), false);
      }
    }
    if (st.state === "succeeded") break;
    if (st.state === "failed") throw new Error(st.error || "Analysis failed on the server");
    await delay(POLL_INTERVAL_MS);
  }

  const resRes = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}/result`);
  if (!resRes.ok) throw new Error(await errText(resRes, "Result fetch failed"));
  const raw = await resRes.json();
  if (!isLive()) return;
  onResult(mapCanonicalToAnalysisData(raw), true);
}

export function useTrackAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  // True once the fast local-DSP "part 1" result is loaded and shown, while the
  // semantic/GPU "part 2" keeps computing (progressive delivery).
  const [part1Ready, setPart1Ready] = useState(false);
  // The server-side id of the current analysis; mirrored into the URL (?id=) so a
  // refresh or shared link re-opens the same result.
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  // Object URL of the uploaded file, so the page can play the actual track
  // locally (later this will be swapped for the HLS stream).
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Guards against a stale in-flight run updating the UI after reset / re-upload.
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
  }, [setTrackUrl]);

  const analyze = useCallback(async (file: File) => {
    const myRun = ++runId.current;
    const live = (fn: () => void) => {
      if (runId.current === myRun) fn();
    };

    setFileName(file.name);
    // Resolve a playable URL (transcodes AIFF -> WAV so it plays too); async, so
    // guard against a stale run replacing the current track.
    void makePlayableUrl(file).then((url) => live(() => setTrackUrl(url)));
    setError(null);
    setData(null);
    setProgress(0);
    setPart1Ready(false);

    try {
      // 1) upload -> enqueue (real byte-level upload progress via XHR)
      live(() => setStatus("uploading"));
      live(() => setProgress(0));
      const form = new FormData();
      form.append("file", file);
      const created = await uploadWithProgress(
        `${ANALYSIS_ENDPOINT}/v1/analyses`,
        form,
        (pct) => live(() => setProgress(pct)),
      );
      const id = created.analysis_id;
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
      );
    } catch (e) {
      live(() => setError(e instanceof Error ? e.message : "Analysis failed"));
      live(() => setStatus("error"));
    }
  }, [setTrackUrl]);

  // Open an existing analysis by id (refresh / shared ?id= link). No local file,
  // so there's no audio to play until we swap in the HLS stream.
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
      );
    } catch (e) {
      live(() => setError(e instanceof Error ? e.message : "Could not load analysis"));
      live(() => setStatus("error"));
    }
  }, [setTrackUrl]);

  return { status, data, error, progress, fileName, audioUrl, part1Ready, analysisId, analyze, loadById, reset };
}
