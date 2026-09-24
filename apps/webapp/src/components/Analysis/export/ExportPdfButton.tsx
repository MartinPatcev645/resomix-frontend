import React, { useCallback, useState } from "react";
import { StatusDialog } from "@resomix/ui";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { WORKSPACE_BTN_SECONDARY } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

/** Where the cover's two links point when the build did not set them (a local dev bundle). */
const LANDING_FALLBACK = "https://resomix.com";
const BETA_FALLBACK = "https://beta.resomix.com";

type State = { kind: "idle" } | { kind: "working" } | { kind: "done"; filename: string } | { kind: "failed" };

/**
 * Download the whole analysis as one A4 document.
 *
 * The writer is loaded on the click and the document takes a fraction of a second to build, which
 * is fast enough to be invisible: the first version simply went quiet and the file appeared in a
 * downloads tray nobody was looking at, so it read as a button that did nothing. It now says what
 * it is doing while it works, refuses a second press, and confirms when the file is on its way.
 */
export const ExportPdfButton: React.FC<{ data: AnalysisData; className?: string }> = ({ data, className }) => {
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = state.kind === "working";

  const run = useCallback(async () => {
    if (busy) return;
    setState({ kind: "working" });
    try {
      const { exportAnalysisPdf } = await import("./exportAnalysisPdf.ts");
      const filename = await exportAnalysisPdf(data, {
        landingUrl: BASE_LANDING_URL || LANDING_FALLBACK,
        betaUrl: BASE_BETA_URL || BETA_FALLBACK,
      });
      setState({ kind: "done", filename });
    } catch (err) {
      console.error("PDF export failed", err);
      setState({ kind: "failed" });
    }
  }, [data, busy]);

  return (
    <>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        aria-busy={busy}
        className={`${WORKSPACE_BTN_SECONDARY} ${busy ? "cursor-progress" : "cursor-pointer"} ${className ?? ""}`}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="mr-[var(--px-8)] inline-block h-[var(--px-12)] w-[var(--px-12)] animate-spin rounded-full border border-current border-t-transparent"
          />
        ) : (
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
        )}
        {busy ? "Exporting" : "Export PDF"}
      </button>

      <StatusDialog
        isOpen={state.kind !== "idle"}
        onClose={() => setState({ kind: "idle" })}
        status={state.kind === "working" ? "loading" : state.kind === "done" ? "success" : "error"}
        eyebrow="Analysis // Export"
        title={
          state.kind === "working" ? "Building your PDF" : state.kind === "done" ? "Export ready" : "Export failed"
        }
        message={
          state.kind === "working" ? (
            "The whole analysis, laid out as an A4 document."
          ) : state.kind === "done" ? (
            <>
              Saved to your downloads as{" "}
              <span className="font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">
                {state.filename}
              </span>
              .
            </>
          ) : (
            "Something went wrong building the document. Please try again."
          )
        }
      />
    </>
  );
};
