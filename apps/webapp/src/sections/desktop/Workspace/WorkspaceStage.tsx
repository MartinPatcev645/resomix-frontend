import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { WORKSPACE_STAGE_CLASS } from "./workspacePanelStyles.ts";
import { scrollWorkspacePanelIntoView } from "./workspaceStateCache.ts";

export const WorkspaceStage: React.FC<{ stageKey: string; children: React.ReactNode }> = ({
  stageKey,
  children,
}) => {
  const location = useLocation();
  // Reveal-scroll ONLY when the user deliberately switched task (Analyse ⇄ Similarity), which tags
  // the navigation with `workspaceModeSwitch` (see WorkspaceShell). A fresh landing / redirect onto
  // the page has no such state → we stay at the top. Captured once at mount (via ref) so the scroll
  // fires once for the switch and not on later in-panel stage changes.
  const revealOnMount = useRef(
    (location.state as { workspaceModeSwitch?: boolean } | null)?.workspaceModeSwitch === true,
  );

  useEffect(() => {
    if (revealOnMount.current) scrollWorkspacePanelIntoView();
  }, []);

  return (
    <div key={stageKey} id="workspace-active-panel" className={WORKSPACE_STAGE_CLASS}>
      {children}
    </div>
  );
};

export const SubmitPendingGlyph: React.FC = () => (
  <span
    aria-hidden="true"
    className="ml-[var(--px-8)] inline-block h-[var(--px-12)] w-[var(--px-12)] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
  />
);
