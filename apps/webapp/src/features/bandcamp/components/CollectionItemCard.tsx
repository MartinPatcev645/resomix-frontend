import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PAGE_BTN_SECONDARY, PAGE_TEXT_LINK, RxBadge, Tooltip } from "@resomix/ui";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import type { BandcampItem } from "../api/types.ts";
import { findSimilarAvailability, getItemStatus, type ActionAvailability } from "../lib/itemStatus.ts";

export const COLLECTION_GRID = "grid grid-cols-1 gap-[var(--px-12)] sm:grid-cols-2 lg:grid-cols-3";

const ACTION_BTN = `${PAGE_BTN_SECONDARY} min-w-0 !whitespace-normal text-center aria-disabled:cursor-not-allowed aria-disabled:border-[rgba(255,255,255,0.12)] aria-disabled:text-[var(--rx-color-disabled)] aria-disabled:hover:bg-transparent`;

function ActionButton({
  label,
  availability,
  onRun,
}: {
  label: string;
  availability: ActionAvailability;
  onRun: () => void;
}) {
  const reasonId = useId();
  const button = (
    <button
      type="button"
      className={`${ACTION_BTN} w-full`}
      // aria-disabled (not disabled) keeps the button focusable, so keyboard users can reach the reason.
      aria-disabled={!availability.enabled || undefined}
      aria-describedby={availability.reason ? reasonId : undefined}
      onClick={() => {
        if (availability.enabled) onRun();
      }}
    >
      {label}
    </button>
  );
  if (!availability.reason) return <div className="flex min-w-0">{button}</div>;
  return (
    <div className="flex min-w-0 [&>div]:flex [&>div]:w-full [&>div]:min-w-0 [&>div>span]:flex [&>div>span]:w-full [&>div>span]:min-w-0">
      <Tooltip message={availability.reason} customWidth="w-[var(--px-200)]">
        {button}
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {availability.reason}
      </span>
    </div>
  );
}

export function CollectionItemCard({ item }: { item: BandcampItem }) {
  const navigate = useNavigate();
  const [artworkFailed, setArtworkFailed] = useState(false);
  const status = getItemStatus(item);
  const findSimilar = findSimilarAvailability(item);
  const typeLabel = item.itemType === "album" ? BANDCAMP_COPY.collection.album : BANDCAMP_COPY.collection.track;
  const showArtwork = item.artworkUrl && !artworkFailed;

  return (
    <article className="flex min-w-0 flex-col gap-[var(--px-12)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-12)]">
      <div className="flex min-w-0 gap-[var(--px-12)] sm:flex-col">
        <div className="aspect-square w-[var(--px-80)] shrink-0 overflow-hidden bg-[rgba(255,255,255,0.04)] sm:w-full">
          {showArtwork ? (
            <img
              src={item.artworkUrl as string}
              alt={BANDCAMP_COPY.collection.artworkAlt(item.title, item.artist)}
              loading="lazy"
              decoding="async"
              onError={() => setArtworkFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div aria-hidden="true" className="flex h-full w-full items-center justify-center font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)]">
              {typeLabel}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[var(--px-6)]">
          <div className="flex flex-wrap items-center gap-[var(--px-6)]">
            <span className="border border-[var(--rx-color-border-subtle)] px-[var(--px-6)] py-[var(--px-2)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)]">
              {typeLabel}
            </span>
            <RxBadge tone={status.tone}>{status.label}</RxBadge>
          </div>
          <h3 className="m-0 truncate font-helvetica text-[length:var(--px-15)] font-medium leading-[var(--px-20)]" title={item.title}>
            {item.title}
          </h3>
          <p className="m-0 truncate font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)]" title={item.artist}>
            {item.artist}
          </p>
          {item.itemType === "track" && item.album ? (
            <p className="m-0 truncate font-helvetica text-[length:var(--px-13)] font-light text-[var(--rx-color-text-muted)]" title={item.album}>
              {BANDCAMP_COPY.collection.fromAlbum(item.album)}
            </p>
          ) : null}
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={BANDCAMP_COPY.collection.openOnBandcampLabel(item.title)}
              className={`${PAGE_TEXT_LINK} self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rx-color-accent)]`}
            >
              {BANDCAMP_COPY.collection.openOnBandcamp} ↗
            </a>
          ) : null}
        </div>
      </div>

      {/* TODO(bandcamp): put Analyze back beside Find similar once analyse-by-track exists. See analyzeAvailability. */}
      <div className="mt-auto grid grid-cols-1">
        <ActionButton
          label={BANDCAMP_COPY.actions.findSimilar}
          availability={findSimilar}
          onRun={() =>
            navigate(`/sonic-discovery?discover=${encodeURIComponent(item.resomixTrackId as string)}`, {
              state: { from: "bandcamp" },
            })
          }
        />
      </div>
    </article>
  );
}
