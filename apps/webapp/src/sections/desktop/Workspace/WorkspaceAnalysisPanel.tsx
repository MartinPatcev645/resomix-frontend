import React, { useCallback, useEffect, useRef, useState } from "react";
import { BASE_LANDING_URL } from "@resomix/config";
import { useEntitlements } from "@resomix/hooks";
import { useAuthStore } from "@resomix/stores";
import { useTrackAnalysis } from "@/pages/analysis/useTrackAnalysis.ts";
import { AnalysisProcessingPanel } from "./AnalysisProcessingPanel.tsx";
import { AnalysisSummaryCard } from "./AnalysisSummaryCard.tsx";
import {
  ANALYSIS_UPLOAD_FORMAT,
  ANALYSIS_UPLOAD_HEADING,
  ANALYSIS_UPLOAD_QUOTA_HINT,
  ANALYSE_TRACK_CTA,
  UPLOAD_PRIVACY_NOTE,
} from "./workspaceCopy.ts";
import { WORKSPACE_PANEL_CLASS, WORKSPACE_STAGE_MIN_H } from "./workspacePanelStyles.ts";
import { SubmitPendingGlyph, WorkspaceStage } from "./WorkspaceStage.tsx";
import {
  clearAnalysisCache,
  getAnalysisCache,
  patchAnalysisCache,
} from "./workspaceStateCache.ts";

const INPUT_ACCEPT = "audio/*,.mp3,.wav,.flac,.aiff,.aif,.mpeg,.mpg,.m4a,.ogg";

export const WorkspaceAnalysisPanel: React.FC = () => {
  const {
    status,
    data,
    error,
    progress,
    fileName,
    analysisId,
    playlistUuid,
    analyze,
    reset,
  } = useTrackAnalysis();
  const { uploadsPerMonth, loading: entitlementsLoading } = useEntitlements();

  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(() => getAnalysisCache().pendingFile);
  const [dragOver, setDragOver] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);

  useEffect(() => {
    patchAnalysisCache({ pendingFile });
  }, [pendingFile]);

  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  useEffect(() => {
    if (sessionExpired) setSubmitPending(false);
  }, [sessionExpired]);

  const pickFile = useCallback((file?: File | null) => {
    if (file) setPendingFile(file);
  }, []);

  const submitAnalysis = () => {
    if (!pendingFile || status !== "idle" || submitPending) return;
    setSubmitPending(true);
    void analyze(pendingFile).finally(() => setSubmitPending(false));
  };

  const resetAll = () => {
    setPendingFile(null);
    clearAnalysisCache();
    reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const processingStep =
    status === "uploading" ? 0 : status === "analyzing" ? (progress >= 85 ? 2 : 1) : status === "done" ? 2 : 0;

  const showSummary = status === "done" && data && analysisId;
  const showProcessing = status === "uploading" || status === "analyzing";
  const showError = status === "error";

  const stageKey = showSummary
    ? "summary"
    : showProcessing
      ? "processing"
      : showError
        ? "error"
        : "idle";

  useEffect(() => {
    if (showSummary) {
      document.getElementById("analysis-summary-heading")?.focus({ preventScroll: true });
    }
  }, [showSummary]);

  const quotaLine =
    !entitlementsLoading && uploadsPerMonth > 0
      ? `${ANALYSIS_UPLOAD_QUOTA_HINT} Your plan includes ${uploadsPerMonth} upload${uploadsPerMonth === 1 ? "" : "s"} per month.`
      : ANALYSIS_UPLOAD_QUOTA_HINT;

  return (
    <section
      className={[WORKSPACE_PANEL_CLASS, WORKSPACE_STAGE_MIN_H].join(" ")}
      aria-labelledby="workspace-analysis-heading"
    >
      <h2 id="workspace-analysis-heading" className="sr-only">
        Analyse a track
      </h2>

      <WorkspaceStage stageKey={stageKey}>
        {showError && (
          <div className="py-[var(--px-16)] text-center">
            <p className="mb-[var(--px-8)] font-helvetica text-[length:var(--px-14)] font-medium uppercase text-[var(--color-accent,#EE4A26)]">
              Analysis failed
            </p>
            {fileName && (
              <p className="mb-[var(--px-8)] font-fira text-[length:var(--px-11)] opacity-50">{fileName}</p>
            )}
            <p className="mx-auto mb-[var(--px-16)] max-w-md break-words text-[length:var(--px-12)] font-helvetica font-light opacity-70">
              {error ?? "Something went wrong."}
            </p>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex min-h-[var(--px-44)] items-center justify-center rounded-full border border-[rgba(255,255,255,.14)] px-[var(--px-16)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] hover:bg-[rgba(255,255,255,.06)]"
            >
              Try again
            </button>
          </div>
        )}

        {showSummary && (
          <AnalysisSummaryCard
            data={data}
            analysisId={analysisId}
            playlistUuid={playlistUuid}
            onReset={resetAll}
          />
        )}

        {showProcessing && !showError && (
          <AnalysisProcessingPanel activeStep={processingStep} fileName={fileName} />
        )}

        {!showSummary && !showProcessing && !showError && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept={INPUT_ACCEPT}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <div
              className={[
                "border border-dashed border-slate-400 px-[var(--px-20)] py-[var(--px-28)] text-center transition-colors",
                dragOver ? "bg-[rgba(255,255,255,.06)]" : "",
              ].join(" ")}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
            >
              <p className="mb-[var(--px-4)] text-[length:var(--px-15)] font-helvetica font-light text-[var(--color-primary)]">
                {ANALYSIS_UPLOAD_HEADING}
              </p>
              <p className="mt-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] opacity-50">
                {ANALYSIS_UPLOAD_FORMAT}
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-[var(--px-14)] inline-block border border-[rgba(255,255,255,.14)] px-[var(--px-14)] py-[var(--px-8)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] hover:border-slate-300"
              >
                Choose file
              </button>
              {pendingFile && (
                <p className="mt-[var(--px-12)] truncate font-fira text-[length:var(--px-11)] opacity-70">
                  {pendingFile.name}
                </p>
              )}
            </div>

            <p className="mt-[var(--px-14)] text-[length:var(--px-12)] font-helvetica font-light leading-[var(--px-18)] opacity-70">
              {UPLOAD_PRIVACY_NOTE}{" "}
              <a
                href={`${BASE_LANDING_URL}/trust`}
                className="underline underline-offset-[var(--px-3)]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Trust, Rights &amp; Security
              </a>
            </p>

            <p className="mt-[var(--px-10)] font-fira text-[length:var(--px-11)] tracking-[var(--px-1)] opacity-60">
              {quotaLine}
            </p>

            <div className="mt-[var(--px-16)]">
              <button
                type="button"
                disabled={!pendingFile || submitPending}
                onClick={submitAnalysis}
                className="inline-flex min-h-[var(--px-44)] items-center justify-center rounded-full bg-[var(--color-primary)] px-[var(--px-22)] font-fira text-[length:var(--px-12)] font-medium uppercase tracking-[var(--px-2)] text-[var(--color-text-primary,#000)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ANALYSE_TRACK_CTA}
                {submitPending ? <SubmitPendingGlyph /> : null}
              </button>
            </div>
          </div>
        )}
      </WorkspaceStage>
    </section>
  );
};
