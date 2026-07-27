import React from "react";
import { Link } from "react-router-dom";
import {
  ANALYSIS_GATE_BODY,
  ANALYSIS_GATE_CTA,
  ANALYSIS_GATE_PRIVACY,
} from "./workspaceCopy.ts";
import { WORKSPACE_PANEL_CLASS } from "./workspacePanelStyles.ts";

const ANALYSIS_RETURN_PATH = "/analysis";

/** Signed-out analysis gate — login-only upload is enforced server-side. */
export const WorkspaceAnalysisGate: React.FC = () => (
  <section
    className={WORKSPACE_PANEL_CLASS}
    aria-labelledby="workspace-analysis-heading"
  >
    <h2 id="workspace-analysis-heading" className="sr-only">
      Analyse a track
    </h2>

    <div className="px-[var(--px-16)] py-[var(--px-24)] text-center">
      <p className="mb-[var(--px-16)] text-[length:var(--px-15)] font-helvetica font-light leading-[var(--px-22)] opacity-80">
        {ANALYSIS_GATE_BODY}
      </p>
      <Link
        to={`/auth/login?redirect=${encodeURIComponent(ANALYSIS_RETURN_PATH)}`}
        state={{ from: ANALYSIS_RETURN_PATH }}
        className="inline-flex min-h-[var(--px-44)] items-center justify-center rounded-full bg-[var(--color-primary)] px-[var(--px-22)] font-fira text-[length:var(--px-12)] font-medium uppercase tracking-[var(--px-2)] text-[var(--color-text-primary,#000)] hover:opacity-90"
      >
        {ANALYSIS_GATE_CTA}
      </Link>
      <p className="mt-[var(--px-16)] text-[length:var(--px-12)] font-helvetica font-light leading-[var(--px-18)] opacity-60">
        {ANALYSIS_GATE_PRIVACY}
      </p>
    </div>
  </section>
);
