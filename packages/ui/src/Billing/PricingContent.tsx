import { ConsumerPricingContent } from "./ConsumerPricingContent";
import { PartnerPricingContent } from "./PartnerPricingContent";
import { Eyebrow, LabelledRule } from "./PricingChrome";

/**
 * Unified pricing page — one page for everyone. Section 1 = consumer plans (individual creators),
 * section 2 = B2B / partner plans. Replaces the old separate `/pricing` (B2B) and `/subscribe`
 * (consumer) pages. The landing app now serves this at `/subscribe` only; `/pricing` is a redirect,
 * because the two routes had converged on rendering exactly this component.
 *
 * Styled to the marketing design system: left-aligned, mono eyebrow over a Benzin headline on the
 * shared 32 / 36 / 48 ramp at weight 900, 44/52 block padding, square hairline panels. It reads as
 * one more landing page rather than a separate app screen. Rendered by BOTH apps — the webapp's
 * /subscribe uses the same component — and every token it relies on exists in both.
 */

interface PricingContentProps {
  /** Target of the "Back to Home" link (site root — differs per app/domain). */
  baseUrl?: string;
  /** Where the B2B CTAs send the user (the partners lead form). */
  partnersUrl?: string;
}

export function PricingContent({ baseUrl = "/", partnersUrl = "/partners#developer-form" }: PricingContentProps) {
  return (
    <section className="overflow-hidden py-[var(--px-44)] font-helvetica text-[var(--color-primary)] lg:py-[var(--px-52)]">
      <div className="space-y-[var(--px-48)] lg:space-y-[var(--px-72)]">
        {/* No extra horizontal padding: the app shell (SideLines) already provides the 20/63 inset
            every other section sits on, so the headline lines up with every hero on the site. */}
        <header>
          <a
            href={baseUrl}
            aria-label="Resomix home"
            className="mb-[var(--px-24)] inline-flex items-center gap-[var(--px-8)] font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em] text-[var(--color-primary-hover)] transition-colors hover:text-[var(--color-primary)]"
          >
            <span aria-hidden="true" className="text-[var(--color-neon-orange)]">←</span>
            Back to home
          </a>

          <Eyebrow>Plans // Pricing</Eyebrow>

          <h1 className="m-0 max-w-[18ch] font-benzin font-black uppercase leading-[1.06] text-[length:var(--px-32)] md:max-w-none md:text-[length:var(--px-36)] lg:text-[length:var(--px-48)]">
            Pricing built around{" "}
            <span className="text-[var(--color-neon-orange)]">what you actually use.</span>
          </h1>

          <p className="mt-[var(--px-24)] max-w-[52ch] font-helvetica text-[length:var(--px-17)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
            One home for every plan — from individual creators to enterprise partners. Pick the
            section that fits you.
          </p>
        </header>

        {/* SECTION 1 — CONSUMER */}
        <ConsumerPricingContent />

        <LabelledRule>Business &amp; Partners</LabelledRule>

        {/* SECTION 2 — B2B */}
        <PartnerPricingContent partnersUrl={partnersUrl} />
      </div>
    </section>
  );
}

export default PricingContent;
