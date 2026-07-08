/**
 * useTrackAnalysis — upload → analyze → result state machine.
 *
 * Talks directly to the resomix-analysis-service async job API:
 *   POST /v1/analyses            -> { analysis_id }
 *   GET  /v1/analyses/{id}       -> { state, progress:{percent}, error }   (poll)
 *   GET  /v1/analyses/{id}/result-> canonical analysis JSON (once succeeded)
 * The snake_case canonical result is adapted to the camelCase `AnalysisData` the
 * dashboard renders via `mapCanonicalToAnalysisData`. We deliberately do NOT use
 * `@resomix/api-client` here — this page owns its service contract.
 *
 * Set `USE_HARDCODED = true` to render the bundled sample without the network
 * (handy for pure-UI work).
 */

import { useCallback, useRef, useState } from "react";
import { ANALYSIS_DATA, type AnalysisData } from "./data.js";
import { mapCanonicalToAnalysisData } from "./mapCanonical.js";

/** resomix-analysis-service (FastAPI). Override with VITE_ANALYSIS_ENDPOINT if needed. */
export const ANALYSIS_ENDPOINT =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_ANALYSIS_ENDPOINT) ??
  "http://localhost:8010";

/** While true, `analyze()` resolves with the bundled sample instead of hitting the network. */
const USE_HARDCODED = false;

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

export function useTrackAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
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

    if (USE_HARDCODED) {
      setStatus("uploading");
      setProgress(12);
      await delay(500);
      setStatus("analyzing");
      for (const p of [30, 50, 72, 90]) {
        await delay(420);
        setProgress(p);
      }
      setData(ANALYSIS_DATA);
      setProgress(100);
      setStatus("done");
      return;
    }

    try {
      // 1) upload -> enqueue
      live(() => setStatus("uploading"));
      live(() => setProgress(5));
      const form = new FormData();
      form.append("file", file);
      const createdRes = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses`, { method: "POST", body: form });
      if (!createdRes.ok) throw new Error(await errText(createdRes, "Upload failed"));
      const created = (await createdRes.json()) as { analysis_id?: string };
      const id = created.analysis_id;
      if (!id) throw new Error("Server did not return an analysis id");

      // 2) poll status until it succeeds/fails
      live(() => setStatus("analyzing"));
      const startedAt = Date.now();
      for (;;) {
        if (runId.current !== myRun) return; // superseded by reset/re-upload
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) throw new Error("Analysis timed out");
        await delay(POLL_INTERVAL_MS);
        const stRes = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${id}`);
        if (!stRes.ok) throw new Error(await errText(stRes, "Status check failed"));
        const st = (await stRes.json()) as { state?: string; progress?: { percent?: number }; error?: string };
        const pct = typeof st.progress?.percent === "number" ? st.progress.percent : 0;
        live(() => setProgress(Math.min(95, Math.max(10, pct))));
        if (st.state === "succeeded") break;
        if (st.state === "failed") throw new Error(st.error || "Analysis failed on the server");
      }

      // 3) fetch + adapt the canonical result
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

  return { status, data, error, progress, fileName, audioUrl, analyze, reset };
}
