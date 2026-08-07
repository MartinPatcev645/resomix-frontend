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

export interface PlanFeaturesOptions {
  /**
   * Four headline lines for the compact plan cards (searches · depth · uploads · analysis).
   * Full mode keeps the longer list including library and exports.
   */
  compact?: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function searchFeature(limits: BillingPlanLimits): PlanFeature {
  return limits.searches_per_day === null
    ? { key: "searches", text: "Unlimited (fair use) sonic searches", included: true }
    : {
        key: "searches",
        text: `${plural(limits.searches_per_day, "sonic search", "sonic searches")} a day`,
        included: limits.searches_per_day > 0,
      };
}

function depthFeature(limits: BillingPlanLimits): PlanFeature | null {
  if (limits.top_sk_max === null) return null;
  return {
    key: "depth",
    text: `Top ${limits.top_sk_max} matches per search`,
    included: limits.top_sk_max > 0,
  };
}

function uploadsFeature(limits: BillingPlanLimits): PlanFeature {
  if (limits.uploads_per_month === null) {
    return { key: "uploads", text: "Unlimited (fair use) uploads", included: true };
  }
  if (limits.uploads_per_month > 0) {
    return {
      key: "uploads",
      text: `${plural(limits.uploads_per_month, "track upload", "track uploads")} a month`,
      included: true,
    };
  }
  return { key: "uploads", text: "Track uploads", included: false };
}

function libraryFeature(limits: BillingPlanLimits): PlanFeature {
  return limits.library_playlists_max === null
    ? { key: "library", text: "Every playlist kept in your Library", included: true }
    : {
        key: "library",
        text: `${plural(limits.library_playlists_max, "playlist", "playlists")} in your Library`,
        included: limits.library_playlists_max > 0,
      };
}

function exportsFeature(limits: BillingPlanLimits): PlanFeature {
  if (limits.exports_per_day === null) {
    return { key: "exports", text: "Unlimited (fair use) exports", included: true };
  }
  if (limits.exports_per_day > 0) {
    return {
      key: "exports",
      text: `${plural(limits.exports_per_day, "export", "exports")} a day`,
      included: true,
    };
  }
  return { key: "exports", text: "Playlist export", included: false };
}

function analysisFeature(limits: BillingPlanLimits): PlanFeature {
  return {
    key: "analysis",
    text: limits.can_view_full_analysis
      ? "Full Track Intelligence"
      : "Complete analysis summary",
    included: true,
  };
}

export function planFeatures(
  limits: BillingPlanLimits | undefined | null,
  options: PlanFeaturesOptions = {},
): PlanFeature[] {
  if (!limits) return [];

  if (options.compact) {
    const features: PlanFeature[] = [searchFeature(limits)];
    const depth = depthFeature(limits);
    if (depth) features.push(depth);
    features.push(uploadsFeature(limits));
    features.push(analysisFeature(limits));
    return features;
  }

  const features: PlanFeature[] = [searchFeature(limits)];
  const depth = depthFeature(limits);
  if (depth) features.push(depth);
  features.push(uploadsFeature(limits));
  features.push(libraryFeature(limits));
  features.push(exportsFeature(limits));
  // Full mode keeps the longer free-summary wording used by existing tests.
  features.push({
    key: "analysis",
    text: limits.can_view_full_analysis
      ? "Full Track Intelligence"
      : "Track summary — BPM, key, energy, structure",
    included: true,
  });

  return features;
}

/** Format a limit count for the comparison table. `null` → Unlimited (fair use). */
export function formatLimitCount(
  value: number | null | undefined,
  unit: { singular: string; plural: string },
  cadence?: string,
): string {
  if (value === null) return "Unlimited (fair use)";
  if (value === undefined || value === 0) return "—";
  const n = `${value} / ${value === 1 ? unit.singular : unit.plural}`;
  return cadence ? `${n}` : n;
}

export function formatPerDay(value: number | null | undefined): string {
  if (value === null) return "Unlimited (fair use)";
  if (value === undefined || value === 0) return "—";
  return `${value} / day`;
}

export function formatPerMonth(value: number | null | undefined): string {
  if (value === null) return "Unlimited (fair use)";
  if (value === undefined || value === 0) return "—";
  return `${value} / month`;
}

export function formatTopN(value: number | null | undefined): string {
  if (value === null) return "Unlimited (fair use)";
  if (value === undefined || value === 0) return "—";
  return `Top ${value}`;
}

export function formatPlainCount(value: number | null | undefined): string {
  if (value === null) return "Unlimited (fair use)";
  if (value === undefined || value === 0) return "—";
  return String(value);
}
