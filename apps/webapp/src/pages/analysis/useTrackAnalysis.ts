/**
 * useTrackAnalysis — upload → analyze → result state machine (TESTING PHASE).
 *
 * For now this returns the hardcoded sample (`ANALYSIS_DATA`) so we can build and
 * verify all the visuals. The live flow against the analysis microservice is
 * sketched below (behind `USE_HARDCODED`) and will be switched on once the visuals
 * are approved. We deliberately do NOT use `@resomix/api-client` here — this page
 * talks to its own service directly.
 */

import { useCallback, useState } from "react";
import { ANALYSIS_DATA, type AnalysisData } from "./data.js";

/** resomix-analysis-service (FastAPI). Async job API: POST upload -> poll -> result. */
export const ANALYSIS_ENDPOINT = "http://localhost:8010";

/** While true, `analyze()` resolves with the bundled sample instead of hitting the network. */
const USE_HARDCODED = true;

export type AnalysisStatus = "idle" | "uploading" | "analyzing" | "done" | "error";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useTrackAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
    setError(null);
    setProgress(0);
    setFileName(null);
  }, []);

  const analyze = useCallback(async (file: File) => {
    setFileName(file.name);
    setError(null);
    setData(null);

    if (USE_HARDCODED) {
      // Simulate the async job lifecycle with the bundled sample.
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

    // --- Live flow (wired once visuals are approved) ------------------------
    // try {
    //   setStatus("uploading");
    //   const form = new FormData();
    //   form.append("file", file);
    //   const created = await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses`, { method: "POST", body: form });
    //   const { analysis_id } = await created.json();
    //   setStatus("analyzing");
    //   // poll GET `${ANALYSIS_ENDPOINT}/v1/analyses/${analysis_id}` until state === "succeeded"
    //   // then GET `${ANALYSIS_ENDPOINT}/v1/analyses/${analysis_id}/result`
    //   // const raw = await (await fetch(`${ANALYSIS_ENDPOINT}/v1/analyses/${analysis_id}/result`)).json();
    //   // setData(mapCanonicalToAnalysisData(raw));
    //   setStatus("done");
    // } catch (e) {
    //   setError(e instanceof Error ? e.message : "Analysis failed");
    //   setStatus("error");
    // }
  }, []);

  return { status, data, error, progress, fileName, analyze, reset };
}
