import { useState, type ReactNode } from "react";
import { PricingButton } from "./PricingButton";
import { Chip, Eyebrow, PlanPanel, SectionBody, SectionHeading } from "./PricingChrome";

/**
 * B2B / partner plans — rendered as the SECOND section of the unified pricing page
 * (`PricingContent`). Single responsive component (Tailwind breakpoints, no JS media queries).
 * Ported from the old standalone landing `/pricing` page. CTAs point at the partners form.
 *
 * Presentation follows the marketing system: square hairline panels, a squared segmented control
 * in place of the rounded pill toggle, mono labels, and the landing button. Pricing and copy are
 * unchanged.
 */

const CheckMark = () => (
  <svg
    className="w-[var(--px-12)] h-[var(--px-12)] shrink-0 stroke-[var(--color-neon-orange)]"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CrossMark = () => (
  <svg
    className="w-[var(--px-12)] h-[var(--px-12)] shrink-0 stroke-current opacity-35"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SoundWaves = () => (
  <svg
    viewBox="0 0 44 24"
    className="w-[var(--px-32)] h-[var(--px-20)] shrink-0 opacity-30"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="3" y1="8" x2="3" y2="16" />
    <line x1="11" y1="4" x2="11" y2="20" />
    <line x1="19" y1="10" x2="19" y2="14" />
    <line x1="27" y1="2" x2="27" y2="22" />
    <line x1="35" y1="7" x2="35" y2="17" />
    <line x1="41" y1="10" x2="41" y2="14" />
  </svg>
);

interface B2BFeature {
  node: ReactNode;
  included: boolean;
}

function B2BCard({
  eyebrow,
  name,
  blurb,
  unit,
  price,
  suffix,
  billed,
  features,
  cta,
  onCta,
  highlighted = false,
}: {
  eyebrow: string;
  name: string;
  blurb: string;
  unit?: string;
  price: string;
  suffix?: string;
  billed: string;
  features: B2BFeature[];
  cta: string;
  onCta: () => void;
  highlighted?: boolean;
}) {
  return (
    <PlanPanel highlighted={highlighted} className="lg:p-[var(--px-28)]">
      {highlighted && (
        <div className="absolute -top-[var(--px-10)] left-1/2 -translate-x-1/2">
          <Chip>Most popular</Chip>
        </div>
      )}

      <div className="space-y-[var(--px-16)] lg:space-y-[var(--px-24)]">
        <div>
          <span className="mb-[var(--px-4)] block font-fira text-[length:var(--px-10)] uppercase tracking-[0.18em] text-[var(--color-primary-hover)] opacity-70">
            {eyebrow}
          </span>
          <h3 className="m-0 font-helvetica text-[length:var(--px-20)] font-bold uppercase tracking-[var(--px-1)] text-[var(--color-text-secondary)]">
            {name}
          </h3>
        </div>

        <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light leading-[1.65] text-[var(--color-primary-hover)]">
          {blurb}
        </p>

        <div className="space-y-[var(--px-4)] border-y border-white/13 py-[var(--px-16)] lg:py-[var(--px-20)]">
          <div className="flex items-baseline gap-[var(--px-2)] lg:gap-[var(--px-4)]">
            {unit && (
              <span className="font-helvetica text-[length:var(--px-16)] font-light text-[var(--color-text-secondary)] lg:text-[length:var(--px-20)]">
                {unit}
              </span>
            )}
            <span className="font-helvetica text-[length:var(--px-32)] font-bold leading-none tracking-tight text-[var(--color-text-secondary)] lg:text-[length:var(--px-44)]">
              {price}
            </span>
            {suffix && (
              <span className="font-fira text-[length:var(--px-10)] uppercase tracking-[0.14em] text-[var(--color-primary-hover)] opacity-70 lg:text-[length:var(--px-12)]">
                {suffix}
              </span>
            )}
          </div>
          <span className="block font-fira text-[length:var(--px-10)] uppercase tracking-[0.14em] text-[var(--color-primary-hover)] opacity-60">
            {billed}
          </span>
        </div>

        <ul className="m-0 list-none space-y-[var(--px-10)] p-0 lg:space-y-[var(--px-14)]">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-[var(--px-10)]">
              {f.included ? <CheckMark /> : <CrossMark />}
              <span
                className={`font-helvetica text-[length:var(--px-13)] font-light leading-[1.5] ${
                  f.included ? "text-[var(--color-primary-hover)]" : "text-[var(--color-primary-hover)] opacity-45 line-through"
                }`}
              >
                {f.node}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-[var(--px-24)] lg:mt-[var(--px-28)]">
        <PricingButton fullWidth variant={highlighted ? "accentLine" : "secondary"} onClick={onCta}>
          {cta}
        </PricingButton>
      </div>
    </PlanPanel>
  );
}

interface PartnerPricingContentProps {
  /** Where the plan CTAs send the user (the partners lead form). */
  partnersUrl?: string;
}

/** Squared segmented control — the marketing system has no pill shapes. */
function BillingToggle({ isAnnual, onChange }: { isAnnual: boolean; onChange: (annual: boolean) => void }) {
  const seg = "px-[var(--px-18)] py-[var(--px-8)] font-fira text-[length:var(--px-11)] uppercase tracking-[0.14em] transition-colors cursor-pointer";
  const on = "bg-[var(--color-neon-orange)] text-[#101010]";
  const off = "bg-transparent text-[var(--color-primary-hover)] hover:text-[var(--color-primary)]";
  return (
    <div
      className="inline-flex rounded-[var(--px-2)] border border-white/13 p-[var(--px-3)]"
      role="group"
      aria-label="Billing interval"
    >
      <button type="button" onClick={() => onChange(false)} aria-pressed={!isAnnual} className={`${seg} ${!isAnnual ? on : off}`}>
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={isAnnual}
        className={`${seg} ${isAnnual ? on : off} flex items-center gap-[var(--px-6)]`}
      >
        <span>Annually</span>
        <span
          className={`rounded-[var(--px-2)] px-[var(--px-6)] py-[var(--px-2)] font-fira text-[length:var(--px-9)] ${
            isAnnual ? "bg-[#101010] text-[var(--color-neon-orange)]" : "border border-white/20"
          }`}
        >
          -17%
        </span>
      </button>
    </div>
  );
}

export function PartnerPricingContent({ partnersUrl = "/partners#developer-form" }: PartnerPricingContentProps) {
  const [isAnnual, setIsAnnual] = useState(true);
  const goPartners = () => {
    window.location.href = partnersUrl;
  };

  const starterPrice = isAnnual ? "82.50" : "99";
  const growthPrice = isAnnual ? "415.83" : "499";
  const starterBilled = isAnnual ? "Billed annually (€990/yr)" : "Billed monthly";
  const growthBilled = isAnnual ? "Billed annually (€4990/yr)" : "Billed monthly";

  return (
    <section className="space-y-[var(--px-32)] lg:space-y-[var(--px-40)]">
      <header>
        <Eyebrow>For Business &amp; Partners</Eyebrow>
        <SectionHeading>Integrate Resomix</SectionHeading>
        <SectionBody className="mt-[var(--px-14)] max-w-[52ch]">
          Integrate Resomix similarity into your own platform. Scale by catalogue size and API
          volume.
        </SectionBody>
      </header>

      {/* Centred: it controls the whole grid below rather than belonging to any one column, so it
          reads as a control for the section instead of another left-aligned copy block. */}
      <div className="flex justify-center">
        <BillingToggle isAnnual={isAnnual} onChange={setIsAnnual} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-[var(--px-24)] pt-[var(--px-12)] lg:grid-cols-3 lg:gap-[var(--px-20)]">
        <B2BCard
          eyebrow="Starter Tenant"
          name="Starter"
          blurb="Perfect for independent platforms, startups, and developers deploying early-stage sound searching."
          unit="€"
          price={starterPrice}
          suffix="/ mo"
          billed={starterBilled}
          cta="Get Starter Key"
          onCta={goPartners}
          features={[
            { included: true, node: <>Up to <strong>5,000</strong> tracks ingested</> },
            { included: true, node: <>Up to <strong>5,000</strong> API calls / month</> },
            { included: true, node: <>Standard similarity indexing</> },
            { included: false, node: <>Silo namespace</> },
          ]}
        />

        <B2BCard
          highlighted
          eyebrow="Growth Tenant"
          name="Growth"
          blurb="Designed for high-volume music agencies, commercial audio platforms, and scaled distributors."
          unit="€"
          price={growthPrice}
          suffix="/ mo"
          billed={growthBilled}
          cta="Get Growth Key"
          onCta={goPartners}
          features={[
            { included: true, node: <>Up to <strong>100,000</strong> tracks ingested</> },
            { included: true, node: <>Up to <strong>100,000</strong> API calls / month</> },
            { included: true, node: <>Priority similarity indexing updates</> },
            { included: true, node: <>Dedicated tenant routing</> },
          ]}
        />

        <B2BCard
          eyebrow="Isolated Namespace"
          name="Enterprise"
          blurb="For enterprise publishers needing complete namespace isolation, high volume limits, and custom SLAs."
          price="Custom"
          billed="Annual custom contract agreements"
          cta="Contact Enterprise"
          onCta={goPartners}
          features={[
            { included: true, node: <><strong>Silo namespace isolation</strong></> },
            { included: true, node: <>Unlimited tracks &amp; API calls</> },
            { included: true, node: <>99.9% Latency &amp; Uptime SLA</> },
            { included: true, node: <>Dedicated dev support engineer</> },
          ]}
        />
      </div>

      <div className="flex items-center justify-center gap-[var(--px-12)] pt-[var(--px-16)] text-center font-fira text-[length:var(--px-10)] uppercase tracking-[0.18em] text-[var(--color-primary-hover)] opacity-60 lg:pt-[var(--px-32)]">
        <SoundWaves />
        <span>All plans are governed by the Resomix B2B Services Agreement</span>
        <SoundWaves />
      </div>
    </section>
  );
}
