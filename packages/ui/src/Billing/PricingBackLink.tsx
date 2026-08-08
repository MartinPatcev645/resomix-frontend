/**
 * Contextual "back" control for the pricing pages.
 *
 * WHY THIS IS NOT JUST `history.back()`
 * -------------------------------------
 * `/subscribe` is reached from four different places across two origins, and each one wants a
 * different word and a different destination. `history.back()` would be right roughly half the
 * time and silently wrong the rest — worst of all after a Stripe redirect, where the previous
 * entry is Stripe, not our page.
 *
 * WHY A QUERY PARAM AND NOT `document.referrer`
 * ---------------------------------------------
 * Under the default `strict-origin-when-cross-origin` referrer policy, a cross-origin navigation
 * exposes only the ORIGIN — so a visitor arriving from the landing site is indistinguishable
 * whether they came from `/pricing` or `/about`. The `?from=` marker is set by whoever links here,
 * so it survives that. `document.referrer` is kept as a fallback for links that predate it, where
 * origin alone is still enough to tell "somewhere in the app" from "somewhere on the site".
 */

export type BackOrigin = "profile" | "pricing" | "app" | "site";

export interface BackTarget {
  label: string;
  href: string;
  /** True when the destination is inside the app this page is running in (client-side nav). */
  internal: boolean;
}

const SONIC_DISCOVERY = { label: "Sonic Discovery", path: "/sonic-discovery" };

/**
 * Where "back" should go, and what it should say.
 *
 * @param search   `window.location.search` — carries the `?from=` marker.
 * @param referrer `document.referrer` — fallback when no marker is present.
 * @param landingOrigin Absolute origin of the marketing site, for cross-origin destinations.
 */
export function resolveBackTarget(
  search: string,
  referrer: string,
  landingOrigin?: string,
): BackTarget {
  const site = (landingOrigin || "").replace(/\/$/, "");
  const from = new URLSearchParams(search || "").get("from") as BackOrigin | null;

  const marker = from ?? inferFromReferrer(referrer, site);

  switch (marker) {
    case "profile":
      return { label: "Back to profile", href: "/profile", internal: true };
    case "pricing":
      // Cross-origin: the comparison table lives on the marketing page, not here.
      return { label: "Back to pricing", href: site ? `${site}/pricing` : "/pricing", internal: !site };
    case "site":
      return { label: "Back to home", href: site || "/", internal: !site };
    case "app":
    default:
      // Also the direct-URL case: someone who typed the address has no history to honour, and the
      // workspace is the one place every signed-in user always wants to get back to.
      return { label: `Back to ${SONIC_DISCOVERY.label}`, href: SONIC_DISCOVERY.path, internal: true };
  }
}

/** Origin-level fallback. Returns null when the referrer tells us nothing useful. */
function inferFromReferrer(referrer: string, site: string): BackOrigin | null {
  if (!referrer) return null; // direct entry, or a referrer-stripping policy
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return null;
  }
  if (typeof window !== "undefined" && url.origin === window.location.origin) {
    // Same app. The path IS available here, so profile can be told apart.
    return url.pathname.startsWith("/profile") ? "profile" : "app";
  }
  if (site && url.origin === site) {
    // Cross-origin: usually only the origin survives, so the path check is best-effort.
    return url.pathname.startsWith("/pricing") ? "pricing" : "site";
  }
  return null;
}

/** Matches the Library's back control so the two read as the same button. */
const BACK_BTN =
  "group inline-flex min-h-[var(--px-44)] cursor-pointer items-center justify-center gap-[var(--px-6)] " +
  "whitespace-nowrap rounded-[var(--rx-radius-control,0)] border border-white/22 bg-transparent " +
  "px-[var(--px-14)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] " +
  "text-[var(--color-primary)] transition-[color,border-color] duration-150 ease-out " +
  "hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]";

export function PricingBackLink({
  target,
  onNavigate,
  id,
}: {
  target: BackTarget;
  /** Client-side navigator for internal destinations. Falls back to a full load when absent. */
  onNavigate?: (path: string) => void;
  id?: string;
}) {
  return (
    <a
      href={target.href}
      id={id}
      aria-label={target.label}
      onClick={(e) => {
        // Let modified clicks (new tab, download) behave natively.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (target.internal && onNavigate) {
          e.preventDefault();
          onNavigate(target.href);
        }
      }}
      className={BACK_BTN}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[var(--px-16)] w-[var(--px-16)] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {target.label}
    </a>
  );
}

export default PricingBackLink;
