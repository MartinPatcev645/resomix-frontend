import React from "react";
import { REFERENCE_CHANGE, REFERENCE_SELECTED_LABEL } from "./workspaceCopy.ts";
import { displayArtistOrOmit, sanitizeWorkspaceTitle } from "@/utils/trackUtils.ts";
import { WORKSPACE_BADGE, WORKSPACE_FOCUS_VISIBLE } from "./workspacePanelStyles.ts";

export type ReferenceSource = "catalogue" | "upload";

export interface WorkspaceReference {
  title: string;
  artist?: string;
  duration?: string;
  source: ReferenceSource;
  detail?: string;
}

export const ReferenceChip: React.FC<{
  reference: WorkspaceReference;
  onChange: () => void;
  onCancel?: () => void;
}> = ({ reference, onChange, onCancel }) => (
  <div className="relative flex flex-wrap items-center gap-x-[var(--px-14)] gap-y-[var(--px-8)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-14)] shadow-[inset_4px_0_0_0_var(--rx-color-accent)] transition-[border-color,background-color] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)] motion-reduce:transition-none">
    <span
      aria-hidden="true"
      className="flex h-[var(--px-40)] w-[var(--px-40)] shrink-0 items-center justify-center rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] font-fira text-[length:var(--px-10)] text-[var(--rx-color-accent)]"
    >
      ◍
    </span>
    <div className="min-w-0 flex-1 basis-[12rem]">
      <p className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-accent)]">
        ▸ {REFERENCE_SELECTED_LABEL}
      </p>
      <p className="truncate font-helvetica text-[length:var(--px-15)] font-medium text-[var(--rx-color-text-primary)]">
        {sanitizeWorkspaceTitle(reference.title)}
      </p>
      <p className="truncate font-fira text-[length:var(--px-11)] tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)]">
        {[displayArtistOrOmit(reference.artist), reference.duration, reference.detail].filter(Boolean).join(" · ")}
      </p>
    </div>
    <span className={WORKSPACE_BADGE}>
      {reference.source === "catalogue" ? "Catalogue" : "Upload"}
    </span>
    <button
      type="button"
      onClick={onChange}
      className={`min-h-[var(--px-44)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-secondary)] hover:text-[var(--rx-color-text-primary)] ${WORKSPACE_FOCUS_VISIBLE}`}
    >
      {REFERENCE_CHANGE}
    </button>
    {onCancel && (
      <button
        type="button"
        onClick={onCancel}
        className={`min-h-[var(--px-44)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] hover:text-[var(--rx-color-text-primary)] ${WORKSPACE_FOCUS_VISIBLE}`}
      >
        Cancel
      </button>
    )}
  </div>
);
