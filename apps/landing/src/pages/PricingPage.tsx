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
  return <PricingContent baseUrl="/" variant="marketing" subscribeUrl={`${BETA_URL}/subscribe?from=pricing`} />;
}
