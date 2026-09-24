import React, { useCallback, useState } from "react";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { WORKSPACE_BTN_SECONDARY } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

/** Where the cover's two links point when the build did not set them (a local dev bundle). */
const LANDING_FALLBACK = "https://resomix.com";
const BETA_FALLBACK = "https://beta.resomix.com";

/**
 * Download the whole analysis as one A4 document.
 *
 * The writer is loaded on the click, not with the page. The export after that is arithmetic and
 * takes well under a second, so the button only has two states: a failure is a real failure rather
 * than something still working.
 */
export const ExportPdfButton: React.FC<{ data: AnalysisData; className?: string }> = ({ data, className }) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async () => {
    if (busy) return;
    setFailed(false);
    setBusy(true);
    try {
      const { exportAnalysisPdf } = await import("./exportAnalysisPdf.ts");
      await exportAnalysisPdf(data, {
        landingUrl: BASE_LANDING_URL || LANDING_FALLBACK,
        betaUrl: BASE_BETA_URL || BETA_FALLBACK,
      });
    } catch (err) {
      console.error("PDF export failed", err);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [data, busy]);

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
        disabled={busy}
        aria-busy={busy}
        className={`${WORKSPACE_BTN_SECONDARY} ${busy ? "cursor-progress" : "cursor-pointer"} ${className ?? ""}`}
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
        {busy ? "Exporting…" : "Export PDF"}
      </button>
    </span>
  );
};
