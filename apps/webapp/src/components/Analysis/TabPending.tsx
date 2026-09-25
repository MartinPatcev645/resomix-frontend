import React from "react";
import { LoadingStep, Spinner } from "@/pages/analysis/charts.tsx";

/**
 * What a tab shows while the data behind it is still being computed.
 *
 * The page is delivered in two parts: the local DSP (tempo, key, loudness, spectrum) lands first,
 * and the model pass (structure, genre, mood, stems) follows. Tabs are per-view, so a reader can
 * now open Genre before genre exists. Saying so beats an empty panel that looks broken, and beats
 * hiding the tab, which would make the bar jump around as parts arrive.
 */
export const TabPending: React.FC<{ title: string; detail: string; pending: boolean }> = ({ title, detail, pending }) => (
  <div className="rounded-[var(--px-10)] border border-[var(--an-border)] bg-[var(--an-lane)] p-[var(--px-32)]">
    {pending ? (
      <div className="flex flex-col items-center gap-[var(--px-16)]">
        <div className="flex items-center gap-[var(--px-10)] font-helvetica text-[length:var(--px-13)] text-[var(--an-text-secondary)]">
          <Spinner size={18} />
          <span>{title} is still computing</span>
        </div>
        <div className="flex flex-col gap-[var(--px-12)]">
          <LoadingStep title="Sound & dynamics" subtitle="tempo · key · loudness · spectrum · ready" done />
          <LoadingStep title="Sound, mood & style" subtitle={detail} />
        </div>
      </div>
    ) : (
      <p className="m-0 text-center font-helvetica text-[length:var(--px-13)] font-light text-[var(--an-text-secondary)]">
        {title} is not available for this track.
      </p>
    )}
  </div>
);
