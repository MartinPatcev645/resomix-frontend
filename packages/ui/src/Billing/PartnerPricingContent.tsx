import { useState, type ReactNode } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";

/**
 * B2B / partner plans — rendered as the SECOND section of the unified pricing page
 * (`PricingContent`). Single responsive component (Tailwind breakpoints, no JS media queries).
 * Ported from the old standalone landing `/pricing` page. CTAs point at the partners form.
 */

const CheckMark = () => (
  <svg
    className="w-[var(--px-12)] h-[var(--px-12)] stroke-current opacity-80 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CrossMark = () => (
  <svg
    className="w-[var(--px-12)] h-[var(--px-12)] stroke-current opacity-40 shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SoundWaves = () => (
  <svg
    viewBox="0 0 44 24"
    className="w-[var(--px-32)] h-[var(--px-20)] opacity-30 shrink-0"
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
    <div
      className={`relative bg-[var(--color-primary-background)]/30 backdrop-blur-md rounded-[var(--px-10)] p-[var(--px-20)] lg:p-[var(--px-28)] flex flex-col justify-between transition-all duration-300 ${
        highlighted
          ? "border-2 border-[var(--color-primary)] hover:border-[var(--color-primary-hover)]"
          : "border border-slate-200 border-dotted hover:border-zinc-500"
      }`}
    >
      {highlighted && (
        <div className="absolute -top-[var(--px-12)] left-1/2 -translate-x-1/2 bg-[var(--color-primary)] text-[var(--color-secondary)] text-[length:var(--px-10)] font-medium px-[var(--px-12)] py-[var(--px-4)] rounded-full uppercase tracking-wider whitespace-nowrap">
          Most Popular
        </div>
      )}

      <div className="space-y-[var(--px-16)] lg:space-y-[var(--px-24)]">
        <div>
          <span className="text-[length:var(--px-9)] lg:text-[length:var(--px-10)] uppercase tracking-wider font-fira opacity-50 block mb-[var(--px-2)] lg:mb-[var(--px-4)]">
            {eyebrow}
          </span>
          <h3 className="text-[length:var(--px-18)] lg:text-[length:var(--px-22)] font-medium uppercase tracking-wide">{name}</h3>
        </div>

        <p className="text-[length:var(--px-12)] lg:text-[length:var(--px-13)] font-extralight leading-[var(--px-16)] lg:leading-[var(--px-18)] opacity-80">
          {blurb}
        </p>

        <div className="border-t border-b border-slate-200 border-dotted py-[var(--px-16)] lg:py-[var(--px-20)] space-y-[var(--px-2)] lg:space-y-[var(--px-4)]">
          <div className="flex items-baseline gap-[var(--px-2)] lg:gap-[var(--px-4)]">
            {unit && <span className="text-[length:var(--px-16)] lg:text-[length:var(--px-20)] font-light">{unit}</span>}
            <span className="text-[length:var(--px-32)] lg:text-[length:var(--px-44)] leading-none font-medium tracking-tight">{price}</span>
            {suffix && <span className="text-[length:var(--px-10)] lg:text-[length:var(--px-12)] opacity-60 font-extralight">{suffix}</span>}
          </div>
          <span className="text-[length:var(--px-9)] lg:text-[length:var(--px-10)] font-fira opacity-50 block">{billed}</span>
        </div>

        <ul className="space-y-[var(--px-10)] lg:space-y-[var(--px-14)]">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-[var(--px-8)] lg:gap-[var(--px-10)]">
              {f.included ? <CheckMark /> : <CrossMark />}
              <span
                className={`font-extralight text-[length:var(--px-12)] lg:text-[length:var(--px-13)] ${
                  f.included ? "" : "opacity-60 line-through"
                }`}
              >
                {f.node}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-[var(--px-20)] lg:mt-[var(--px-28)]">
        <ButtonSleek text={cta} onClick={onCta} customWidth="w-full" transparent />
      </div>
    </div>
  );
}

interface PartnerPricingContentProps {
  /** Where the plan CTAs send the user (the partners lead form). */
  partnersUrl?: string;
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
    <section className="space-y-[var(--px-24)] lg:space-y-[var(--px-40)]">
      <header className="text-center">
        <h2 className="text-[length:var(--px-22)] lg:text-[length:var(--px-28)] font-medium uppercase tracking-wide">
          For Business &amp; Partners
        </h2>
        <p className="mt-[var(--px-6)] text-[length:var(--px-12)] lg:text-[length:var(--px-10)] font-extralight opacity-70 max-w-xl mx-auto">
          Integrate Resomix similarity into your own platform. Scale by catalogue size and API volume.
        </p>
      </header>

      {/* ANNUAL / MONTHLY TOGGLE */}
      <div className="flex justify-center items-center">
        <div className="border border-slate-200 border-dotted rounded-full p-[var(--px-4)] flex items-center bg-[var(--color-primary-background)]/20 backdrop-blur-sm">
          <button
            onClick={() => setIsAnnual(false)}
            className={`px-[var(--px-14)] lg:px-[var(--px-18)] py-[var(--px-6)] lg:py-[var(--px-8)] rounded-full text-[length:var(--px-10)] lg:text-[length:var(--px-11)] font-medium uppercase tracking-wider transition-all cursor-pointer ${
              !isAnnual
                ? "bg-[var(--color-primary)] text-[var(--color-secondary)]"
                : "bg-transparent text-[var(--color-primary)] opacity-60 hover:opacity-100"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={`px-[var(--px-14)] lg:px-[var(--px-18)] py-[var(--px-6)] lg:py-[var(--px-8)] rounded-full text-[length:var(--px-10)] lg:text-[length:var(--px-11)] font-medium uppercase tracking-wider transition-all cursor-pointer flex items-center gap-[var(--px-4)] lg:gap-[var(--px-6)] ${
              isAnnual
                ? "bg-[var(--color-primary)] text-[var(--color-secondary)]"
                : "bg-transparent text-[var(--color-primary)] opacity-60 hover:opacity-100"
            }`}
          >
            <span>Annually</span>
            <span
              className={`px-[var(--px-6)] py-[var(--px-2)] rounded text-[length:var(--px-8)] lg:text-[length:var(--px-9)] font-fira uppercase ${
                isAnnual
                  ? "bg-[var(--color-secondary)] text-[var(--color-primary)]"
                  : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              }`}
            >
              -17%
            </span>
          </button>
        </div>
      </div>

      {/* PRICING GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--px-24)] lg:gap-[var(--px-20)] items-stretch pt-[var(--px-12)]">
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

      {/* FOOTER NOTE */}
      <div className="text-center text-[length:var(--px-10)] lg:text-[length:var(--px-11)] opacity-50 font-fira tracking-widest pt-[var(--px-16)] lg:pt-[var(--px-32)] uppercase flex items-center justify-center gap-[var(--px-8)] lg:gap-[var(--px-12)]">
        <SoundWaves />
        <span>All plans are governed by the Resomix B2B Services Agreement</span>
        <SoundWaves />
      </div>
    </section>
  );
}

export default PartnerPricingContent;
