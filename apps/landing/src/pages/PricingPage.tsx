import { PricingContent } from "@resomix/ui";

/**
 * /pricing — now the unified pricing page (consumer section first, B2B section below).
 * The old B2B-only implementation moved into the shared `PartnerPricingContent` section.
 */
export default function PricingPage() {
  return <PricingContent baseUrl="/" />;
}
