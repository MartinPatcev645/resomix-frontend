import { useMemo } from "react";
import { useEntitlements } from "./useEntitlements";

/**
 * Data for the workspace usage chip (pricing v2.1, E1) — `⌕ 2/3 today · ↑ 4/5 this month`.
 *
 * All the deciding happens here so the component only renders. What is worth knowing:
 *
 *   * **A metric is shown only when both halves are real numbers.** Half a fraction is worse than
 *     no fraction: "2/" or "/3" reads as a bug, and a lone number reads as a limit.
 *   * **`null` is not zero.** The server sends `null` for a limit that is unlimited and for usage
 *     it could not read (Redis down). Rendering either as `0` would state something false — "0/3
 *     searches left" to someone with three.
 *   * **Unlimited is hidden, not shown as ∞.** Usage IS tracked for Pro (it is what the fair-use
 *     position rests on), but a counter with no denominator is not information a user can act on.
 *     The data is here if that ever changes.
 *   * **Zero limits are hidden.** A guest's `0` is a login wall, not a spent allowance, and
 *     "0/0 today" describes it as failure rather than as a prompt.
 */
export interface UsageMetric {
  /** Stable id for keys and tests: "searches" | "uploads" | "exports" | "library". */
  key: string;
  /** Compact glyph shown before the numbers. */
  glyph: string;
  used: number;
  limit: number;
  /** Period wording — "today", "this month", or "" for the Library, which has no window. */
  period: string;
  /** Accessible label, since the glyph carries no meaning to a screen reader. */
  label: string;
  /** Hover/focus explanation — the glyphs are compact to the point of being cryptic. */
  hint: string;
  /** True once the allowance is fully spent — the caller may style it as depleted. */
  spent: boolean;
}

export interface UseUsageChip {
  /** Only the metrics worth rendering; empty when there is nothing to say. */
  metrics: UsageMetric[];
  /** Nothing to render — either still loading, or every metric is unlimited/unknown. */
  hidden: boolean;
  /** ISO timestamp of the soonest reset among the shown metrics, or null. */
  nextResetAt: string | null;
}

interface MetricSpec {
  key: string;
  glyph: string;
  period: string;
  label: string;
  hint: string;
  used: number | null | undefined;
  limit: number | null | undefined;
  resetAt?: string | null;
}

export function useUsageChip(): UseUsageChip {
  const { limits, usage, resets, loading } = useEntitlements();

  return useMemo(() => {
    if (loading || !limits || !usage) {
      return { metrics: [], hidden: true, nextResetAt: null };
    }

    const specs: MetricSpec[] = [
      {
        key: "searches",
        hint: "Sonic searches you have run today. Resets at midnight UTC.",
        glyph: "⌕",
        period: "today",
        label: "Sonic searches used today",
        used: usage.searches_used_today,
        limit: limits.searches_per_day,
        resetAt: resets?.search_at,
      },
      {
        key: "uploads",
        hint: "Tracks you have uploaded this billing period. Resets on your renewal date.",
        glyph: "↑",
        period: "this month",
        label: "Uploads used this month",
        used: usage.uploads_used_month,
        limit: limits.uploads_per_month,
        resetAt: resets?.upload_at,
      },
      {
        key: "exports",
        hint: "Playlist exports today — TXT, Apple Music and embed all count. Resets at midnight UTC.",
        glyph: "⤓",
        period: "today",
        label: "Exports used today",
        used: usage.exports_used_today,
        limit: limits.exports_per_day,
        resetAt: resets?.export_at,
      },
      {
        key: "library",
        hint: "Playlists listed in your Library. Beyond this they are still saved and open by link, just not listed.",
        glyph: "≡",
        // The Library cap is not a window — deleting a playlist frees a slot immediately — so it
        // carries no period wording and contributes no reset time.
        period: "",
        label: "Playlists shown in your Library",
        used: usage.library_playlists_used,
        limit: limits.library_playlists_max,
      },
    ];

    const metrics: UsageMetric[] = [];
    let nextResetAt: string | null = null;

    for (const spec of specs) {
      // Both halves must be real numbers. `typeof` rather than a truthiness check: `0` is a
      // legitimate usage value and the most common one.
      if (typeof spec.used !== "number" || typeof spec.limit !== "number") continue;
      if (spec.limit <= 0) continue; // unlimited is null already; 0 is a login wall, not a quota

      metrics.push({
        key: spec.key,
        glyph: spec.glyph,
        used: spec.used,
        limit: spec.limit,
        period: spec.period,
        label: spec.label,
        hint: spec.hint,
        spent: spec.used >= spec.limit,
      });

      if (spec.resetAt && (nextResetAt === null || spec.resetAt < nextResetAt)) {
        // ISO-8601 with a fixed offset sorts correctly as a string, so no Date parsing is needed.
        nextResetAt = spec.resetAt;
      }
    }

    return { metrics, hidden: metrics.length === 0, nextResetAt };
  }, [limits, usage, resets, loading]);
}
