import React from "react";
import {
  WorkspaceShell as DesktopWorkspaceShell,
  type WorkspaceMode,
} from "../../desktop/Workspace/WorkspaceShell.tsx";
import { WorkspaceTaskSelector } from "./WorkspaceTaskSelector.tsx";

export type { WorkspaceMode };

/**
 * Mobile workspace chrome — same header, how-it-works accordion, and stage grid as desktop,
 * with the task-card block swapped for a two-up radiogroup (see WorkspaceTaskSelector).
 *
 * Implemented via optional slots on the desktop shell so desktop output stays default-identical
 * when those props are omitted.
 */
export const WorkspaceShell: React.FC<{
  mode: WorkspaceMode;
  children: React.ReactNode;
}> = ({ mode, children }) => (
  <DesktopWorkspaceShell
    mode={mode}
    // The chip is rendered inside WorkspaceTaskSelector on mobile — full width above the task
    // heading, where the desktop puts it beside that heading. Suppressed here so there is only
    // ever one. Session pill stays in the header.
    usageChip={null}
    taskSelector={<WorkspaceTaskSelector mode={mode} />}
  >
    {children}
  </DesktopWorkspaceShell>
);
