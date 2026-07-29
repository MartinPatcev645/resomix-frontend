import { useEffect } from "react";

import { WORKSPACE_BTN_SECONDARY, WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

interface PlaybackUnavailableProps {
  onRetry: () => void;
  /** Fits inside the inline seek-bar slot (single compact row). */
  compact?: boolean;
  /** Centre the message in its slot at full white, for the mobile player's progress-bar row. */
  centered?: boolean;
  /** Technical detail for console logging only — never shown in the UI. */
  detail?: string | null;
}

/**
 * House treatment for failed playback — no raw HTTP / engine errors in the UI.
 */
export function PlaybackUnavailable({ onRetry, compact = false, centered = false, detail }: PlaybackUnavailableProps) {
  useEffect(() => {
    if (detail) {
      console.error("[playback]", detail);
    }
  }, [detail]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        compact
          ? [
              "flex min-w-0 flex-wrap items-center gap-x-[var(--px-8)] gap-y-[var(--px-4)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)]",
              centered ? "w-full justify-center text-center" : "flex-1 opacity-75",
            ].join(" ")
          : "absolute inset-0 flex flex-col items-center justify-center gap-[var(--px-6)] bg-[var(--color-secondary-background)]/80 font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-80"
      }
    >
      <span className="min-w-0 leading-[var(--px-12)]">Playback unavailable</span>
      <button
        type="button"
        onClick={onRetry}
        className={
          compact
            ? // Mobile drops to 35px so Retry matches the 35×35 transport/row chrome around it.
              `${WORKSPACE_BTN_SECONDARY} ${WORKSPACE_FOCUS_VISIBLE} shrink-0 px-[var(--px-8)] max-[767px]:min-h-[var(--px-35)]`
            : `${WORKSPACE_BTN_SECONDARY} ${WORKSPACE_FOCUS_VISIBLE} px-[var(--px-12)] py-[var(--px-6)]`
        }
      >
        Retry
      </button>
    </div>
  );
}
