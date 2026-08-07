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
    // Searches-only remaining counter lives in WorkspaceTaskSelector; hide the shared multi-metric
    // UsageChip so guests do not see two counters. Session chip stays in the header.
    usageChip={null}
    taskSelector={<WorkspaceTaskSelector mode={mode} />}
  >
    {children}
  </DesktopWorkspaceShell>
);
