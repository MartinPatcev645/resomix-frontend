import type { RxStatusTone } from "@resomix/ui";
import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import type { BandcampItem } from "../api/types.ts";

export interface ItemStatus {
  label: string;
  tone: RxStatusTone;
}

/**
 * The badge for one collection item: whether it is already in the Resomix catalogue.
 * These rows have no audio here, so the badge never claims they have been analysed.
 */
export function getItemStatus(item: Pick<BandcampItem, "resomixTrackId">): ItemStatus {
  return item.resomixTrackId
    ? { label: BANDCAMP_COPY.status.inResomix, tone: "accent" }
    : { label: BANDCAMP_COPY.status.notInResomix, tone: "neutral" };
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
 * Track Intelligence has no analyse-by-track route yet, so the collection does not render Analyze.
 * TODO(bandcamp): enable for matched items once the collection returns an
 * `analysis_uuid` (open `/track-intelligence?id=`) or the backend adds analyse-by-track.
 */
export function analyzeAvailability(item: ActionItem): ActionAvailability {
  return { enabled: false, reason: unavailableReason(item) ?? BANDCAMP_COPY.actions.analyzeComingSoon };
}
