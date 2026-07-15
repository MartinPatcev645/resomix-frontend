import { ConsumerPricingContent } from "./ConsumerPricingContent";
import { PartnerPricingContent } from "./PartnerPricingContent";

/**
 * Unified pricing page — one page for everyone. Section 1 = consumer plans (individual creators),
 * section 2 = B2B / partner plans. Replaces the old separate `/pricing` (B2B) and `/subscribe`
 * (consumer) pages; both routes render this. Fully responsive (mobile + desktop).
 */

interface PricingContentProps {
  /** Target of the "Back to Home" link (site root — differs per app/domain). */
  baseUrl?: string;
  /** Where the B2B CTAs send the user (the partners lead form). */
  partnersUrl?: string;
}

export function PricingContent({ baseUrl = "/", partnersUrl = "/partners#developer-form" }: PricingContentProps) {
  return (
    <section className="pt-[var(--px-80)] lg:pt-[var(--px-120)] pb-[var(--px-80)] px-[var(--px-20)] md:px-[var(--px-40)] tracking-[var(--px-1)] text-[var(--color-primary)] font-helvetica overflow-hidden">
      <div className="max-w-[var(--px-1100)] mx-auto space-y-[var(--px-48)] lg:space-y-[var(--px-80)]">
        {/* BACK TO HOME */}
        <div>
          <a
            href={baseUrl}
            aria-label="Resomix home"
            className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light hover:text-[var(--color-primary-hover)] transition-colors"
          >
            ← Back to Home
          </a>
        </div>

        {/* MAIN HEADER */}
        <header className="text-center">
          <h1 className="text-[length:var(--px-28)] leading-[var(--px-34)] lg:text-[length:var(--px-52)] lg:leading-[var(--px-60)] font-medium uppercase">
            Pricing
          </h1>
          <p className="mt-[var(--px-10)] text-[length:var(--px-13)] lg:text-[length:var(--px-11)] font-extralight lg:opacity-80 max-w-xl mx-auto">
            One home for every plan — from individual creators to enterprise partners. Pick the section that fits you.
          </p>
        </header>

        {/* SECTION 1 — CONSUMER */}
        <ConsumerPricingContent />

        {/* SECTION DIVIDER */}
        <div className="flex items-center gap-[var(--px-16)]" aria-hidden="true">
          <span className="flex-1 border-t border-dotted border-slate-300/50" />
          <span className="text-[length:var(--px-10)] uppercase tracking-widest font-fira opacity-40 whitespace-nowrap">
            Business &amp; Partners
          </span>
          <span className="flex-1 border-t border-dotted border-slate-300/50" />
        </div>

        {/* SECTION 2 — B2B */}
        <PartnerPricingContent partnersUrl={partnersUrl} />
      </div>
    </section>
  );
}

export default PricingContent;
