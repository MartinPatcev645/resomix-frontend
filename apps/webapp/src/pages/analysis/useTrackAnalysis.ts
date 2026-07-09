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

export function useTrackAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  // True once the fast local-DSP "part 1" result is loaded and shown, while the
  // semantic/GPU "part 2" keeps computing (progressive delivery).
  const [part1Ready, setPart1Ready] = useState(false);
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
  }, [setTrackUrl]);

  const analyze = useCallback(async (file: File) => {
    const myRun = ++runId.current;
    const live = (fn: () => void) => {
      if (runId.current === myRun) fn();
    };

    setFileName(file.name);
    setTrackUrl(URL.createObjectURL(file));
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

      // 2) poll status; render PART 1 (local DSP) as soon as it's ready, then
      //    keep polling until the full (part 2 / GPU) result succeeds.
      live(() => setStatus("analyzing"));
      const startedAt = Date.now();
      let part1Shown = false;
      for (;;) {
        if (runId.current !== myRun) return; // superseded by reset/re-upload
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) throw new Error("Analysis timed out");
        await delay(POLL_INTERVAL_MS);
        const stRes = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}`);
        if (!stRes.ok) throw new Error(await errText(stRes, "Status check failed"));
        const st = (await stRes.json()) as {
          state?: string;
          part1_ready?: boolean;
          progress?: { percent?: number };
          error?: string;
        };
        const pct = typeof st.progress?.percent === "number" ? st.progress.percent : 0;
        live(() => setProgress(Math.min(95, Math.max(10, pct))));

        if (st.part1_ready && !part1Shown) {
          part1Shown = true;
          const p1 = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}/result`);
          if (p1.ok) {
            const raw = await p1.json();
            if (runId.current !== myRun) return;
            live(() => {
              setData(mapCanonicalToAnalysisData(raw));
              setPart1Ready(true);
            });
          }
        }
        if (st.state === "succeeded") break;
        if (st.state === "failed") throw new Error(st.error || "Analysis failed on the server");
      }

      // 3) fetch + adapt the FULL canonical result
      const resRes = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}/result`);
      if (!resRes.ok) throw new Error(await errText(resRes, "Result fetch failed"));
      const raw = await resRes.json();
      if (runId.current !== myRun) return;
      live(() => setData(mapCanonicalToAnalysisData(raw)));
      live(() => setProgress(100));
      live(() => setStatus("done"));
    } catch (e) {
      live(() => setError(e instanceof Error ? e.message : "Analysis failed"));
      live(() => setStatus("error"));
    }
  }, [setTrackUrl]);

  return { status, data, error, progress, fileName, audioUrl, part1Ready, analyze, reset };
}
