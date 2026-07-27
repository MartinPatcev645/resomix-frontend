import { useEffect } from "react";

interface PlaybackUnavailableProps {
  onRetry: () => void;
  /** Fits inside the inline seek-bar slot (single compact row). */
  compact?: boolean;
  /** Technical detail for console logging only — never shown in the UI. */
  detail?: string | null;
}

/**
 * House treatment for failed playback — no raw HTTP / engine errors in the UI.
 */
export function PlaybackUnavailable({ onRetry, compact = false, detail }: PlaybackUnavailableProps) {
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
          ? "flex min-w-0 flex-1 flex-wrap items-center gap-x-[var(--px-8)] gap-y-[var(--px-4)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-75"
          : "absolute inset-0 flex flex-col items-center justify-center gap-[var(--px-6)] bg-[var(--color-secondary-background)]/80 font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-80"
      }
    >
      <span className="min-w-0 leading-[var(--px-12)]">Playback unavailable</span>
      <button
        type="button"
        onClick={onRetry}
        className={
          compact
            ? "shrink-0 min-h-[var(--px-44)] min-w-[var(--px-44)] px-[var(--px-8)] border border-dotted border-slate-200/60 hover:border-slate-200 hover:opacity-100"
            : "min-h-[var(--px-44)] min-w-[var(--px-44)] px-[var(--px-12)] py-[var(--px-6)] border border-dotted border-slate-200 hover:opacity-100"
        }
      >
        Retry
      </button>
    </div>
  );
}
