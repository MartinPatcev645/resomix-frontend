import React, { useCallback, useState } from "react";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { WORKSPACE_BTN_SECONDARY } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

/** Where the cover's two links point when the build did not set them (a local dev bundle). */
const LANDING_FALLBACK = "https://resomix.com";
const BETA_FALLBACK = "https://beta.resomix.com";

const LABELS: Record<Stage, string> = {
  idle: "Export PDF",
  building: "Laying out…",
  drawing: "Rendering…",
  saving: "Saving…",
};

type Stage = "idle" | "building" | "drawing" | "saving";

/**
 * Download the whole analysis as one A4 document.
 *
 * Everything the export needs is loaded on the click, not with the page: the PDF writer and the
 * DOM capture are ~400KB between them, and the reader who never presses this should not pay for
 * them. The work itself is a second or two of hidden rendering, so the button says where it is up
 * to rather than freezing on one word.
 */
export const ExportPdfButton: React.FC<{ data: AnalysisData; className?: string }> = ({ data, className }) => {
  const [stage, setStage] = useState<Stage>("idle");
  const [failed, setFailed] = useState(false);

  const run = useCallback(async () => {
    if (stage !== "idle") return;
    setFailed(false);
    setStage("building");
    try {
      const { exportAnalysisPdf } = await import("./exportAnalysisPdf.tsx");
      await exportAnalysisPdf(data, {
        landingUrl: BASE_LANDING_URL || LANDING_FALLBACK,
        betaUrl: BASE_BETA_URL || BETA_FALLBACK,
        onStage: setStage,
      });
    } catch (err) {
      console.error("PDF export failed", err);
      setFailed(true);
    } finally {
      setStage("idle");
    }
  }, [data, stage]);

  return (
    <span className="inline-flex items-center gap-[var(--px-10)]">
      {failed && (
        <span className="font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">
          export failed, try again
        </span>
      )}
      <button
        type="button"
        onClick={() => void run()}
        disabled={stage !== "idle"}
        aria-busy={stage !== "idle"}
        className={`${WORKSPACE_BTN_SECONDARY} ${stage === "idle" ? "cursor-pointer" : "cursor-progress"} ${className ?? ""}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="mr-[var(--px-8)] h-[var(--px-13)] w-[var(--px-13)] fill-none stroke-current"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v12" />
          <polyline points="7 11 12 16 17 11" />
          <path d="M4 20h16" />
        </svg>
        {LABELS[stage]}
      </button>
    </span>
  );
};
