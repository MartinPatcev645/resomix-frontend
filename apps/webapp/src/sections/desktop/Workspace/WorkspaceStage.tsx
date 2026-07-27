import React, { useEffect } from "react";
import { WORKSPACE_STAGE_CLASS } from "./workspacePanelStyles.ts";
import { scrollWorkspacePanelIntoView } from "./workspaceStateCache.ts";

export const WorkspaceStage: React.FC<{ stageKey: string; children: React.ReactNode }> = ({
  stageKey,
  children,
}) => {
  useEffect(() => {
    scrollWorkspacePanelIntoView();
  }, [stageKey]);

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
