import { forwardRef } from "react";
import { PAGE_BTN_PRIMARY, PAGE_KICKER, PAGE_PANEL } from "@resomix/ui";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import type { BandcampApiError } from "../api/types.ts";
import type { SyncPollingState } from "../hooks/useSyncJobPolling.ts";
import { ErrorBody, StateNotice } from "./StateNotice.tsx";
import { errorCopyFor } from "../lib/errorCopy.ts";

interface SyncProgressProps {
  sync: SyncPollingState;
  username: string | null;
  onRetry: () => void;
  retrying: boolean;
  retryError: BandcampApiError | null;
}

export const SyncProgress = forwardRef<HTMLHeadingElement, SyncProgressProps>(function SyncProgress(
  { sync, username, onRetry, retrying, retryError },
  ref,
) {
  const failed = sync.status === "failed" || sync.requestError !== null;

  if (failed) {
    const requestKind = sync.requestError?.kind;
    const body =
      sync.status === "failed"
        ? sync.error ?? BANDCAMP_COPY.sync.failedFallback
        : requestKind
          ? <ErrorBody kind={requestKind} />
          : BANDCAMP_COPY.sync.failedFallback;
    return (
      <div className="flex flex-col gap-[var(--px-16)]">
        <h2 ref={ref} tabIndex={-1} className="sr-only">
          {BANDCAMP_COPY.sync.failedTitle}
        </h2>
        <StateNotice tone="error" urgent title={BANDCAMP_COPY.sync.failedTitle} body={body}>
          <button type="button" className={PAGE_BTN_PRIMARY} onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
            {BANDCAMP_COPY.sync.retry}
          </button>
        </StateNotice>
        {retryError ? (
          <StateNotice tone="error" urgent title={errorCopyFor(retryError.kind).title} body={<ErrorBody kind={retryError.kind} />} />
        ) : null}
      </div>
    );
  }

  const known = sync.total !== null && sync.total > 0;
  const processed = known ? Math.min(sync.processed, sync.total as number) : sync.processed;
  const percent = known ? Math.round((processed / (sync.total as number)) * 100) : null;
  const label = known
    ? BANDCAMP_COPY.sync.progressKnown(processed, sync.total as number)
    : sync.status === "pending" || sync.status === "idle"
      ? BANDCAMP_COPY.sync.pending
      : BANDCAMP_COPY.sync.progressUnknown;

  return (
    <section className={`${PAGE_PANEL} flex flex-col gap-[var(--px-14)]`} aria-labelledby="bandcamp-sync-title">
      <h2 id="bandcamp-sync-title" ref={ref} tabIndex={-1} className={`${PAGE_KICKER} focus:outline-none`}>
        {BANDCAMP_COPY.sync.title}
        {username ? <span className="text-[var(--rx-color-text-muted)]"> · {username}</span> : null}
      </h2>
      <div role="status" aria-live="polite" aria-atomic="true" className="font-helvetica text-[length:var(--px-15)] font-light text-[var(--rx-color-text-secondary)]">
        {label}
      </div>
      <div
        role="progressbar"
        aria-label={BANDCAMP_COPY.sync.title}
        aria-valuemin={known ? 0 : undefined}
        aria-valuemax={known ? 100 : undefined}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={label}
        className="relative h-[var(--px-4)] w-full overflow-hidden bg-[var(--rx-color-border-subtle)]"
      >
        {percent !== null ? (
          <div
            className="h-full bg-[var(--rx-color-accent)] transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-[var(--rx-color-accent)] opacity-50 motion-reduce:animate-none" />
        )}
      </div>
      <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light text-[var(--rx-color-text-muted)]">
        {BANDCAMP_COPY.sync.keepOpen}
      </p>
    </section>
  );
});
