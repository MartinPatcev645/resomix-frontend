import { useNavigate } from "react-router-dom";
import { PricingContent } from "@resomix/ui";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

/**
 * In-app subscription flow at `/subscribe` (the profile "Upgrade" button routes here, and so does
 * every plan CTA on the marketing site's `/pricing`).
 *
 * `variant="checkout"`: this page transacts. It reads the session, takes the EU withdrawal-waiver
 * consent and opens Stripe Checkout. It deliberately omits the comparison table and the FAQ, which
 * belong to `/pricing` on the marketing site: anyone arriving here has already been sold to, and
 * duplicating that material would also duplicate it for search engines across two origins.
 */
export default function SubscribePage() {
  const navigate = useNavigate();
  return (
    <PricingContent
      baseUrl={BASE_BETA_URL}
      variant="checkout"
      partnersUrl={BASE_LANDING_URL ? `${BASE_LANDING_URL}/partners#developer-form` : undefined}
      compareUrl={BASE_LANDING_URL ? `${BASE_LANDING_URL}/pricing#compare-h` : undefined}
      landingOrigin={BASE_LANDING_URL}
      onNavigate={(path) => navigate(path)}
    />
  );
}
