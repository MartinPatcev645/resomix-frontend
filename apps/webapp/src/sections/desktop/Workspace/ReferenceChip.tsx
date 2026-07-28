import React from "react";
import { REFERENCE_CHANGE, REFERENCE_SELECTED_LABEL } from "./workspaceCopy.ts";
import { displayArtistOrOmit, sanitizeWorkspaceTitle } from "@/utils/trackUtils.ts";

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
}> = ({ reference, onChange }) => (
  <div className="relative flex flex-wrap items-center gap-x-[var(--px-14)] gap-y-[var(--px-8)] border border-[rgba(238,74,38,.5)] bg-[linear-gradient(to_right,rgba(238,74,38,.05),rgba(238,74,38,.012)_55%,transparent)] p-[var(--px-14)] transition-[border-color,background-color] duration-150 ease-out motion-reduce:transition-none">
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-px -left-px -top-px w-[length:var(--px-3)] bg-[var(--color-neon-orange,#EE4A26)]"
    />
    <span
      aria-hidden="true"
      className="flex h-[var(--px-40)] w-[var(--px-40)] shrink-0 items-center justify-center border border-dotted border-slate-400 font-fira text-[length:var(--px-10)] text-[var(--color-neon-orange,#EE4A26)]"
    >
      ◍
    </span>
    <div className="min-w-0 flex-1 basis-[12rem]">
      <p className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--color-neon-orange,#EE4A26)]">
        ▸ {REFERENCE_SELECTED_LABEL}
      </p>
      <p className="truncate font-helvetica text-[length:var(--px-15)] font-medium">
        {sanitizeWorkspaceTitle(reference.title)}
      </p>
      <p className="truncate font-fira text-[length:var(--px-11)] tracking-[var(--px-1)] opacity-75">
        {[displayArtistOrOmit(reference.artist), reference.duration, reference.detail].filter(Boolean).join(" · ")}
      </p>
    </div>
    <span className="whitespace-nowrap border border-[rgba(255,255,255,.14)] px-[var(--px-8)] py-[var(--px-4)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-2)] opacity-75">
      {reference.source === "catalogue" ? "Catalogue" : "Upload"}
    </span>
    <button
      type="button"
      onClick={onChange}
      className="min-h-[var(--px-44)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] opacity-75 hover:opacity-100"
    >
      {REFERENCE_CHANGE}
    </button>
  </div>
);
