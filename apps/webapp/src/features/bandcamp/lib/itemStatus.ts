import type { RxStatusTone } from "@resomix/ui";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import type { BandcampItem } from "../api/types.ts";

export interface ItemStatus {
  label: string;
  tone: RxStatusTone;
}

/**
 * The badge for one collection item.
 *
 * An explicit analysis state is the more specific fact, so it wins; otherwise the badge says
 * whether the item is in the Resomix catalogue. "none" with no track id means nothing has been
 * queued — it must not read as "pending".
 */
export function getItemStatus(item: Pick<BandcampItem, "analysisStatus" | "resomixTrackId">): ItemStatus {
  switch (item.analysisStatus) {
    case "queued":
      return { label: BANDCAMP_COPY.status.pending, tone: "neutral" };
    case "done":
      return { label: BANDCAMP_COPY.status.done, tone: "success" };
    case "failed":
      return { label: BANDCAMP_COPY.status.failed, tone: "error" };
    default:
      return item.resomixTrackId
        ? { label: BANDCAMP_COPY.status.inResomix, tone: "accent" }
        : { label: BANDCAMP_COPY.status.notInResomix, tone: "neutral" };
  }
}

export interface ActionAvailability {
  enabled: boolean;
  /** Shown as the tooltip / accessible description when disabled. */
  reason: string | null;
}

type ActionItem = Pick<BandcampItem, "itemType" | "resomixTrackId">;

export function canRunActions(item: ActionItem): boolean {
  return Boolean(item.resomixTrackId);
}

function unavailableReason(item: ActionItem): string | null {
  if (canRunActions(item)) return null;
  return item.itemType === "album" ? BANDCAMP_COPY.actions.albumDisabled : BANDCAMP_COPY.actions.unmatchedDisabled;
}

export function findSimilarAvailability(item: ActionItem): ActionAvailability {
  const reason = unavailableReason(item);
  return { enabled: reason === null, reason };
}

/**
 * Track Intelligence has no "analyse by catalogue track id" endpoint yet, so Analyze is off for
 * every item. TODO(bandcamp): enable for matched items once the collection returns an
 * `analysis_uuid` (open `/track-intelligence?id=`) or the backend adds analyse-by-track.
 */
export function analyzeAvailability(item: ActionItem): ActionAvailability {
  return { enabled: false, reason: unavailableReason(item) ?? BANDCAMP_COPY.actions.analyzeComingSoon };
}
