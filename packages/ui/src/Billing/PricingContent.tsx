import { ConsumerPricingContent } from "./ConsumerPricingContent";
import { PricingButton } from "./PricingButton";
import { SoftPanel } from "./PricingChrome";
import { PAGE, PARTNER_BANNER } from "./pricingCopy";
import type { PricingVariant } from "./pricingVariant";

/**
 * Consumer pricing page — Free / Pro decision, comparison, FAQ, then a quiet partner signpost.
 * Partner / API tiers live on `/partners/pricing`, not here.
 *
 * Styled to the marketing design system: centred "Pricing" Benzin headline on the shared
 * 32 / 36 / 48 ramp at weight 900, 44/52 block padding, square hairline panels. Rendered by BOTH
 * apps — the webapp's /subscribe uses the same component — and every token it relies on exists in
 * both.
 *
 * No `overflow-hidden` on the page shell: an overflow ancestor would capture `position:sticky` on
 * the comparison table header.
 *
 * Closing rhythm: hero block (title + API-bound subtitle + consumer body) then partner banner at
 * the standard section gap — not an oversized void after the FAQ.
 */

interface PricingContentProps {
  /** Target of the "Back to Home" link (site root — differs per app/domain). */
  baseUrl?: string;
  /** Where the partner signpost CTA sends the user (the partners lead form). */
  partnersUrl?: string;
  /** See `PricingVariant`: the marketing page compares and hands off, checkout transacts. */
  variant?: PricingVariant;
  /** Marketing only: where the plan CTAs send the visitor to actually subscribe. */
  subscribeUrl?: string;
}

export function PricingContent({
  baseUrl = "/",
  partnersUrl = "/partners#developer-form",
  variant = "marketing",
  subscribeUrl,
}: PricingContentProps) {
  return (
    <section className="py-[var(--px-44)] font-helvetica text-[var(--color-primary)] lg:py-[var(--px-52)]">
      <div className="space-y-[var(--px-48)] lg:space-y-[var(--px-72)]">
        {/* No extra horizontal padding: the app shell (SideLines) already provides the 20/63 inset
            every other section sits on, so the headline lines up with every hero on the site.
            Subtitle lives in ConsumerPricingContent so the match count binds to top_sk_max. */}
        <div>
          <header className="text-center">
            <a
              href={baseUrl}
              aria-label="Resomix home"
              className="mb-[var(--px-24)] inline-flex items-center gap-[var(--px-8)] font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em] text-[var(--color-primary-hover)] transition-colors hover:text-[var(--color-primary)]"
            >
              <span aria-hidden="true" className="text-[var(--color-neon-orange)]">←</span>
              {PAGE.backHome}
            </a>

            <h1 className="m-0 mx-auto font-benzin font-black uppercase leading-[1.06] text-[length:var(--px-32)] md:text-[length:var(--px-36)] lg:text-[length:var(--px-48)]">
              <span className="text-[var(--color-neon-orange)]">{PAGE.title}</span>
            </h1>
          </header>

          <ConsumerPricingContent baseUrl={baseUrl} variant={variant} subscribeUrl={subscribeUrl} />
        </div>

        {/* Partner signpost — no price, no tiers. Outline CTA only; Pro stays the sole primary. */}
        <section aria-labelledby="partner-banner-h" className="pt-0">
          <SoftPanel className="grid items-center gap-[var(--px-16)] min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:gap-[var(--px-32)]">
            <div>
              <p className="m-0 font-fira text-[length:var(--px-11)] uppercase tracking-[0.16em] text-[var(--color-primary-hover)]">
                {PARTNER_BANNER.label}
              </p>
              <h2
                id="partner-banner-h"
                className="m-0 mt-[var(--px-11)] font-helvetica text-[length:var(--px-17)] font-bold uppercase leading-[1.2] tracking-[0.03em] text-[var(--color-text-secondary)]"
              >
                {PARTNER_BANNER.heading}
              </h2>
              <p className="m-0 mt-[var(--px-11)] max-w-[44rem] font-helvetica text-[length:var(--px-15)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
                {PARTNER_BANNER.body}
              </p>
            </div>
            <PricingButton
              onClick={() => {
                window.location.href = partnersUrl;
              }}
            >
              {PARTNER_BANNER.cta}
            </PricingButton>
          </SoftPanel>
        </section>
      </div>
    </section>
  );
}

export default PricingContent;
