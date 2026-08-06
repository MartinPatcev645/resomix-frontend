import type { BillingPlanLimits } from "@resomix/api-client";

/**
 * Turn a plan's limits into the bullet list on its pricing card (pricing v2.1, E4).
 *
 * Pure, and separate from the component, so every line can be tested — this is the text a
 * prospective customer reads before paying, and a number that disagrees with what they then get is
 * the most expensive kind of wrong.
 *
 * WHY IT IS BUILT FROM THE PAYLOAD
 * --------------------------------
 * The limits come from the same `plan_entitlements` rows that enforce them, so an admin raising a
 * cap updates the marketing page in the same breath. Hard-coded copy silently starts lying the
 * first time anyone edits a plan — and nothing fails, which is why nobody notices.
 *
 * `null` = unlimited, `0` = not included. The two are opposites, so neither may be treated as
 * "falsy". House rule (§6.2): "unlimited" is always written "unlimited (fair use)".
 */

export interface PlanFeature {
  /** Stable id for keys and tests. */
  key: string;
  text: string;
  /** False when the plan does not include this at all — render it muted or struck through. */
  included: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function planFeatures(limits: BillingPlanLimits | undefined | null): PlanFeature[] {
  if (!limits) return [];

  const features: PlanFeature[] = [];

  // Searches — the headline number, and the only one that is unlimited on Pro.
  features.push(
    limits.searches_per_day === null
      ? { key: "searches", text: "Unlimited (fair use) sonic searches", included: true }
      : {
          key: "searches",
          text: `${plural(limits.searches_per_day, "sonic search", "sonic searches")} a day`,
          included: limits.searches_per_day > 0,
        },
  );

  // Depth: what you SEE, not what you may select. The dropdown number is larger on free and
  // quoting it here would promise 50 matches to someone who gets 20 unlocked.
  if (limits.top_sk_max !== null) {
    features.push({
      key: "depth",
      text: `Top ${limits.top_sk_max} matches per search`,
      included: limits.top_sk_max > 0,
    });
  }

  // Uploads.
  if (limits.uploads_per_month === null) {
    features.push({ key: "uploads", text: "Unlimited (fair use) uploads", included: true });
  } else if (limits.uploads_per_month > 0) {
    features.push({
      key: "uploads",
      text: `${plural(limits.uploads_per_month, "track upload", "track uploads")} a month`,
      included: true,
    });
  } else {
    features.push({ key: "uploads", text: "Track uploads", included: false });
  }

  // Library — a listing cap, never a deletion. The card must not imply playlists disappear.
  features.push(
    limits.library_playlists_max === null
      ? { key: "library", text: "Every playlist kept in your Library", included: true }
      : {
          key: "library",
          text: `${plural(limits.library_playlists_max, "playlist", "playlists")} in your Library`,
          included: limits.library_playlists_max > 0,
        },
  );

  // Exports.
  if (limits.exports_per_day === null) {
    features.push({ key: "exports", text: "Unlimited (fair use) exports", included: true });
  } else if (limits.exports_per_day > 0) {
    features.push({
      key: "exports",
      text: `${plural(limits.exports_per_day, "export", "exports")} a day`,
      included: true,
    });
  } else {
    features.push({ key: "exports", text: "Playlist export", included: false });
  }

  // The analysis boundary — a page, not a count.
  features.push({
    key: "analysis",
    text: limits.can_view_full_analysis
      ? "Full Track Intelligence"
      : "Track summary — BPM, key, energy, structure",
    included: true,
  });

  return features;
}
