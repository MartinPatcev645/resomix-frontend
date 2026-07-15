import { PricingContent } from "@resomix/ui";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

/**
 * Unified pricing page in the webapp (the profile "Upgrade" button routes here).
 * Consumer section + B2B section. The partners form lives on the landing site, so the B2B CTAs
 * point there.
 */
export default function SubscribePage() {
  return (
    <PricingContent
      baseUrl={BASE_BETA_URL}
      partnersUrl={BASE_LANDING_URL ? `${BASE_LANDING_URL}/partners#developer-form` : undefined}
    />
  );
}
