import { ConsumerPricingContent } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";

/** Consumer plans / subscribe page in the webapp (the profile "Upgrade" button routes here). */
export default function SubscribePage() {
  return <ConsumerPricingContent baseUrl={BASE_BETA_URL} />;
}
