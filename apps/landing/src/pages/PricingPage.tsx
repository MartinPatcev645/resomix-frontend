import { PricingContent } from "@resomix/ui";
import { BETA_URL } from "@/components/Navigation/navData.ts";

/**
 * Public pricing page at `/pricing` (the old `/subscribe` path redirects here).
 *
 * Marketing only: it explains and compares the plans and then hands off to the app. Nobody is
 * signed in on the marketing origin, so purchasing here would mean bouncing the visitor to a login
 * on another domain mid-checkout. Instead every plan CTA goes to `beta.resomix.com/subscribe`,
 * which resolves the session first and then runs the real flow.
 */
export default function PricingPage() {
  return (
    // Extra top gap, landing-only. LandingLayout offsets the fixed header by
    // `calc(--nav-hdr-h - 3px)`, which clears the nav ROW but not the Catalogue Pilot / Try Resomix
    // buttons that float beneath it — leaving the headline almost touching them. The webapp's
    // /subscribe sits under a taller offset and already reads correctly, so this stays here rather
    // than going into the shared PricingContent, where it would push that page down too.
    <div className="pt-[var(--px-16)] lg:pt-[var(--px-64)]">
      <PricingContent baseUrl="/" variant="marketing" subscribeUrl={`${BETA_URL}/subscribe?from=pricing`} />
    </div>
  );
}
