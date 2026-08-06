import type { QuotaDenial } from "@resomix/api-client";

/**
 * What a 402 says to the user (pricing v2.1, E2).
 *
 * A pure function: denial in, copy out. No React, no fetching — so every branch can be tested
 * exhaustively, which matters because this is the text a user reads at the exact moment we refuse
 * them something.
 *
 * WHY THE NUMBERS COME FROM THE PAYLOAD
 * -------------------------------------
 * The server already resolved the caller's plan when it decided to refuse. Re-deriving the limit
 * from cached entitlements risks the two disagreeing at the worst possible moment — telling
 * someone they have 3 searches in the same breath as refusing their 4th.
 *
 * §6.2's example copy quotes "€7.99/month founding price". That is **not** reproduced here: a price
 * baked into a modal goes stale silently and is wrong in every currency but one. The CTA routes to
 * the pricing page, where the number is rendered from live data.
 *
 * The house UI-text rules apply (§6.2): no accuracy percentages, no "AI", no competitor names, no
 * uptime claims, and "unlimited" is always written "unlimited (fair use)".
 */

export interface QuotaCopy {
  /** Small label above the title. */
  eyebrow: string;
  title: string;
  body: string;
  /** Which CTA set to render: a signup wall or an upgrade prompt. */
  reason: "login_required" | "upgrade_required";
}

/** Feature keys, as the server reports them in `metric`. */
const METRIC_SEARCH = "search_playlists_per_month";
const METRIC_UPLOADS = "uploads_per_month";
const METRIC_EXPORTS = "exports_per_day";

const UPGRADE = "upgrade_required";
const LOGIN = "login_required";

/** "3 free sonic searches" reads better than "your sonic searches" when we know the number. */
const withLimit = (limit: number | null | undefined, singular: string, plural: string): string =>
  typeof limit === "number" && limit > 0
    ? `${limit} ${limit === 1 ? singular : plural}`
    : plural;

function quotaExceeded(denial: QuotaDenial): QuotaCopy {
  const limit = denial.quota?.limit;

  if (denial.quota?.metric === METRIC_UPLOADS) {
    return {
      eyebrow: "Plan // Upgrade",
      title: "Upload limit reached",
      body:
        `You've used your ${withLimit(limit, "upload", "uploads")} for this month. ` +
        `Pro includes more uploads every month, and your existing analyses stay where they are.`,
      reason: UPGRADE,
    };
  }

  if (denial.quota?.metric === METRIC_EXPORTS) return exportLimit();

  // Search is the default: it is the most common denial and the only one a guest can reach.
  return {
    eyebrow: "Plan // Upgrade",
    title: "Daily searches used",
    body:
      `You've used today's ${withLimit(limit, "free sonic search", "free sonic searches")}. ` +
      `They come back tomorrow — or go unlimited (fair use) with Pro.`,
    reason: UPGRADE,
  };
}

const exportLimit = (): QuotaCopy => ({
  eyebrow: "Plan // Upgrade",
  title: "Daily export used",
  body: "You've used today's export. Pro exports as often as you like.",
  reason: UPGRADE,
});

const libraryFull = (denial: QuotaDenial): QuotaCopy => ({
  eyebrow: "Plan // Upgrade",
  title: "Library is full",
  body:
    `Free accounts keep ${withLimit(denial.quota?.limit, "playlist", "playlists")} in your ` +
    `Library. Your new playlist is still saved and works by link — it just isn't listed. ` +
    `Pro keeps every playlist in your Library.`,
  reason: UPGRADE,
});

/**
 * `plan_required` covers anything the plan does not include at all. Waiting will not help, so the
 * copy must never mention a reset — and it names what the reader still HAS, because being told only
 * what they cannot do misdescribes their account.
 */
function planRequired(denial: QuotaDenial): QuotaCopy {
  const isAnalysis = /analysis|intelligence/i.test(denial.error ?? "");
  if (isAnalysis) {
    return {
      eyebrow: "Plan // Upgrade",
      title: "Full Track Intelligence is a Pro feature",
      body:
        "Your summary — BPM, key, energy and structure — stays free. Pro adds the full breakdown: " +
        "spectrograms, the chromagram, beat and phrase grids, mood and genre over time, and stem " +
        "composition.",
      reason: UPGRADE,
    };
  }
  if (/embed/i.test(denial.error ?? "")) {
    return {
      eyebrow: "Plan // Upgrade",
      title: "Embed sharing is a Pro feature",
      body: "Pro lets you embed a playlist anywhere you can paste an iframe.",
      reason: UPGRADE,
    };
  }
  return {
    eyebrow: "Plan // Upgrade",
    title: "Not included in your plan",
    // The server's sentence is the only thing that knows WHICH capability this was.
    body: denial.error || "This feature isn't part of your current plan.",
    reason: UPGRADE,
  };
}

const loginRequired = (denial: QuotaDenial): QuotaCopy => ({
  eyebrow: "Access // Sign in",
  title: "Create a free account",
  body: denial.error || "Create a free account or log in to do this.",
  reason: LOGIN,
});

/**
 * Resolve the copy for a denial. `null` when there is nothing to show — an unrecognised code is
 * deliberately silent rather than guessed at, because a modal built from a code we do not
 * understand will say something wrong with full confidence.
 */
export function quotaDenialCopy(denial: QuotaDenial | null): QuotaCopy | null {
  if (!denial) return null;

  switch (denial.code) {
    case "quota_exceeded":
      return quotaExceeded(denial);
    case "library_full":
      return libraryFull(denial);
    case "export_limit_reached":
      return exportLimit();
    case "plan_required":
      return planRequired(denial);
    case "login_required":
      return loginRequired(denial);
    default:
      // A 402 with no code we recognise. `reason` is the older contract and still trustworthy, so
      // fall back to it with the server's own sentence rather than inventing one.
      if (denial.reason === LOGIN) return loginRequired(denial);
      if (denial.reason === UPGRADE) {
        return {
          eyebrow: "Plan // Upgrade",
          title: "Plan limit reached",
          body: denial.error || "You've reached a limit on your current plan.",
          reason: UPGRADE,
        };
      }
      return null;
  }
}
