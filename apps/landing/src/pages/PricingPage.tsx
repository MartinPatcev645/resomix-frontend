import { useState } from "react";
import { useResponsive } from "@resomix/hooks";
import { ButtonSleek } from "@resomix/ui";
import SoundWaves from "../assets/icons/sound_waves.svg";

interface MarkProps {
  className?: string;
}

const CheckMark = ({ className = "" }: MarkProps) => (
  <svg className={`w-[var(--px-12)] h-[var(--px-12)] stroke-current opacity-80 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const CrossMark = ({ className = "" }: MarkProps) => (
  <svg className={`w-[var(--px-12)] h-[var(--px-12)] stroke-current opacity-40 ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function PricingPage() {
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    return <PricingDesktop />;
  } else {
    return <PricingMobile />;
  }
}

// ─── DESKTOP VIEW (Viewport >= 1024px) ───────────────────────────────────────
function PricingDesktop() {
  const [isAnnual, setIsAnnual] = useState(true);

  const starterPrice = isAnnual ? 82.50 : 99;
  const growthPrice = isAnnual ? 415.83 : 499;

  const starterTotal = isAnnual ? 990 : 99;
  const growthTotal = isAnnual ? 4990 : 499;

  return (
    <section className="pt-[var(--px-120)] pb-[var(--px-80)] px-[var(--px-40)] tracking-[var(--px-1)] w-full select-none font-helvetica overflow-hidden relative text-[var(--color-primary)]">
      <div className="max-w-[var(--px-1100)] mx-auto relative z-10 space-y-[var(--px-80)]">
        
        {/* HERO SECTION */}
        <header className="mb-[var(--px-28)]">
          <div className="mb-[var(--px-24)] text-left">
            <a href="/" aria-label="Resomix home" className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors">
              ← Back to Home
            </a>
          </div>
          <div className="text-center">
            <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
              B2B PRICING TIERS
            </h1>
            <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
              Scale your sound matches logically. Choose a plan that matches your catalogue size.
            </p>
          </div>
        </header>

        {/* ANNUAL / MONTHLY TOGGLE SELECTOR */}
        <div className="flex justify-center items-center">
          <div className="border border-slate-200 border-dotted rounded-full p-[var(--px-4)] flex items-center bg-[var(--color-primary-background)]/20 backdrop-blur-sm">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-[var(--px-18)] py-[var(--px-8)] rounded-full text-[length:var(--px-11)] font-medium uppercase font-helvetica tracking-wider transition-all cursor-pointer ${
                !isAnnual
                  ? "bg-[var(--color-primary)] text-[var(--color-secondary)]"
                  : "bg-transparent text-[var(--color-primary)] opacity-60 hover:opacity-100"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-[var(--px-18)] py-[var(--px-8)] rounded-full text-[length:var(--px-11)] font-medium uppercase font-helvetica tracking-wider transition-all cursor-pointer flex items-center gap-[var(--px-6)] ${
                isAnnual
                  ? "bg-[var(--color-primary)] text-[var(--color-secondary)]"
                  : "bg-transparent text-[var(--color-primary)] opacity-60 hover:opacity-100"
              }`}
            >
              <span>Annually</span>
              <span className={`px-[var(--px-6)] py-[var(--px-2)] rounded text-[length:var(--px-9)] font-fira uppercase ${
                isAnnual
                  ? "bg-[var(--color-secondary)] text-[var(--color-primary)]"
                  : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              }`}>
                -17%
              </span>
            </button>
          </div>
        </div>

        {/* PRICING GRID */}
        <div className="grid grid-cols-3 gap-[var(--px-20)] items-stretch pt-[var(--px-12)]">
          
          {/* STARTER CARD */}
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted rounded-[var(--px-10)] p-[var(--px-28)] flex flex-col justify-between hover:border-zinc-500 transition-all duration-300 group relative">
            <div className="space-y-[var(--px-24)]">
              <div>
                <span className="text-[length:var(--px-10)] uppercase tracking-wider font-fira opacity-50 block mb-[var(--px-4)]">Starter Tenant</span>
                <h3 className="text-[length:var(--px-22)] font-medium font-helvetica uppercase tracking-wide">Starter</h3>
              </div>
              <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-80">
                Perfect for independent platforms, startups, and developers looking to deploy early stage sound searching.
              </p>
              
              <div className="border-t border-b border-slate-200 border-dotted py-[var(--px-20)] space-y-[var(--px-4)]">
                <div className="flex items-baseline gap-[var(--px-4)]">
                  <span className="text-[length:var(--px-20)] font-light font-helvetica">€</span>
                  <span className="text-[length:var(--px-44)] leading-none font-medium font-helvetica tracking-tight">{starterPrice}</span>
                  <span className="text-[length:var(--px-12)] opacity-60 font-helvetica font-extralight">/ mo</span>
                </div>
                <span className="text-[length:var(--px-10)] font-fira opacity-50 block">
                  {isAnnual ? `Billed annually (€${starterTotal}/yr)` : "Billed monthly"}
                </span>
              </div>

              <ul className="space-y-[var(--px-14)]">
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Up to <strong>5,000</strong> tracks ingested</span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Up to <strong>5,000</strong> API calls / month</span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Standard similarity indexing</span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CrossMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)] opacity-60 line-through">Silo namespace</span>
                </li>
              </ul>
            </div>
            <div className="mt-[var(--px-28)]">
              <ButtonSleek
                text="Get Starter Key"
                onClick={() => { window.location.href = "/partners#developer-form"; }}
                customWidth="w-full"
                transparent={true}
              />
            </div>
          </div>

          {/* GROWTH CARD */}
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border-2 border-[var(--color-primary)] rounded-[var(--px-10)] p-[var(--px-28)] flex flex-col justify-between hover:border-[var(--color-primary-hover)] transition-all duration-300 group relative">
            <div className="absolute -top-[var(--px-12)] left-1/2 transform -translate-x-1/2 bg-[var(--color-primary)] text-[var(--color-secondary)] text-[length:var(--px-10)] font-helvetica font-medium px-[var(--px-12)] py-[var(--px-4)] rounded-full uppercase tracking-wider">
              Most Popular
            </div>
            
            <div className="space-y-[var(--px-24)]">
              <div>
                <span className="text-[length:var(--px-10)] uppercase tracking-wider font-fira opacity-50 block mb-[var(--px-4)]">Growth Tenant</span>
                <h3 className="text-[length:var(--px-22)] font-medium font-helvetica uppercase tracking-wide">Growth</h3>
              </div>
              <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-90">
                Designed for high volume music agencies, commercial audio platforms, and scaled distributors.
              </p>
              
              <div className="border-t border-b border-slate-200 border-dotted py-[var(--px-20)] space-y-[var(--px-4)]">
                <div className="flex items-baseline gap-[var(--px-4)]">
                  <span className="text-[length:var(--px-20)] font-light font-helvetica">€</span>
                  <span className="text-[length:var(--px-44)] leading-none font-medium font-helvetica tracking-tight">{growthPrice}</span>
                  <span className="text-[length:var(--px-12)] opacity-60 font-helvetica font-extralight">/ mo</span>
                </div>
                <span className="text-[length:var(--px-10)] font-fira opacity-50 block">
                  {isAnnual ? `Billed annually (€${growthTotal}/yr)` : "Billed monthly"}
                </span>
              </div>

              <ul className="space-y-[var(--px-14)]">
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Up to <strong>100,000</strong> tracks ingested</span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Up to <strong>100,000</strong> API calls / month</span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Priority similarity indexing updates</span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Dedicated tenant routing</span>
                </li>
              </ul>
            </div>
            <div className="mt-[var(--px-28)]">
              <ButtonSleek
                text="Get Growth Key"
                onClick={() => { window.location.href = "/partners#developer-form"; }}
                customWidth="w-full"
                transparent={true}
              />
            </div>
          </div>

          {/* ENTERPRISE CARD */}
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted rounded-[var(--px-10)] p-[var(--px-28)] flex flex-col justify-between hover:border-zinc-500 transition-all duration-300 group relative">
            <div className="space-y-[var(--px-24)]">
              <div>
                <span className="text-[length:var(--px-10)] uppercase tracking-wider font-fira opacity-50 block mb-[var(--px-4)]">Isolated Namespace</span>
                <h3 className="text-[length:var(--px-22)] font-medium font-helvetica uppercase tracking-wide">Enterprise</h3>
              </div>
              <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-80">
                For enterprise publishers needing complete legal namespace isolation, high volume limits, and custom SLAs.
              </p>
              
              <div className="border-t border-b border-slate-200 border-dotted py-[var(--px-20)] space-y-[var(--px-4)]">
                <div className="flex items-baseline gap-[var(--px-4)]">
                  <span className="text-[length:var(--px-44)] leading-none font-medium font-helvetica tracking-tight">Custom</span>
                </div>
                <span className="text-[length:var(--px-10)] font-fira opacity-50 block">
                  Annual custom contract agreements
                </span>
              </div>

              <ul className="space-y-[var(--px-14)]">
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]"><strong>Silo namespace isolation</strong></span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Unlimited tracks & API calls</span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">99.9% Latency & Uptime SLA</span>
                </li>
                <li className="flex items-center gap-[var(--px-10)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-13)]">Dedicated dev support engineer</span>
                </li>
              </ul>
            </div>
            <div className="mt-[var(--px-28)]">
              <ButtonSleek
                text="Contact Enterprise"
                onClick={() => { window.location.href = "/partners#developer-form"; }}
                customWidth="w-full"
                transparent={true}
              />
            </div>
          </div>

        </div>

        {/* PRICING FOOTER NOTE */}
        <div className="text-center text-[length:var(--px-11)] opacity-50 font-fira tracking-widest pt-[var(--px-32)] uppercase flex items-center justify-center gap-[var(--px-12)]">
          <img src={SoundWaves} className="w-[var(--px-32)] h-[var(--px-24)] opacity-30" alt="" />
          <span>All plans are governed by the Resomix B2B Services Agreement</span>
          <img src={SoundWaves} className="w-[var(--px-32)] h-[var(--px-24)] opacity-30" alt="" />
        </div>

      </div>
    </section>
  );
}

// ─── MOBILE VIEW (Viewport < 1024px) ─────────────────────────────────────────
function PricingMobile() {
  const [isAnnual, setIsAnnual] = useState(true);

  const starterPrice = isAnnual ? 82.50 : 99;
  const growthPrice = isAnnual ? 415.83 : 499;

  const starterTotal = isAnnual ? 990 : 99;
  const growthTotal = isAnnual ? 4990 : 499;

  return (
    <section className="pt-[var(--px-80)] pb-[var(--px-60)] px-[var(--px-20)] tracking-[var(--px-1)] w-full select-none font-helvetica overflow-hidden relative text-[var(--color-primary)]">
      <div className="w-full relative z-10 space-y-[var(--px-48)]">
        
        {/* HERO SECTION */}
        <header className="mb-[var(--px-28)]">
          <div className="mb-[var(--px-20)] text-left">
            <a href="/" aria-label="Resomix home" className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors">
              ← Back to Home
            </a>
          </div>
          <div className="text-center">
            <h1 className="text-[length:var(--px-28)] leading-[var(--px-34)] font-medium font-helvetica uppercase">
              B2B PRICING TIERS
            </h1>
            <p className="mt-[var(--px-8)] text-[length:var(--px-12)] font-extralight opacity-80 font-helvetica">
              Scale your sound matches logically. Choose a plan that matches your catalogue size.
            </p>
          </div>
        </header>

        {/* ANNUAL / MONTHLY TOGGLE SELECTOR */}
        <div className="flex justify-center items-center">
          <div className="border border-slate-200 border-dotted rounded-full p-[var(--px-4)] flex items-center bg-[var(--color-primary-background)]/20 backdrop-blur-sm">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-[var(--px-14)] py-[var(--px-6)] rounded-full text-[length:var(--px-10)] font-medium uppercase font-helvetica tracking-wider transition-all cursor-pointer ${
                !isAnnual
                  ? "bg-[var(--color-primary)] text-[var(--color-secondary)]"
                  : "bg-transparent text-[var(--color-primary)] opacity-60 hover:opacity-100"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-[var(--px-14)] py-[var(--px-6)] rounded-full text-[length:var(--px-10)] font-medium uppercase font-helvetica tracking-wider transition-all cursor-pointer flex items-center gap-[var(--px-4)] ${
                isAnnual
                  ? "bg-[var(--color-primary)] text-[var(--color-secondary)]"
                  : "bg-transparent text-[var(--color-primary)] opacity-60 hover:opacity-100"
              }`}
            >
              <span>Annually</span>
              <span className={`px-[var(--px-4)] py-[1px] rounded text-[length:var(--px-8)] font-fira uppercase ${
                isAnnual
                  ? "bg-[var(--color-secondary)] text-[var(--color-primary)]"
                  : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              }`}>
                -17%
              </span>
            </button>
          </div>
        </div>

        {/* PRICING GRID */}
        <div className="flex flex-col gap-[var(--px-24)]">
          
          {/* STARTER CARD */}
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted rounded-[var(--px-8)] p-[var(--px-20)] flex flex-col justify-between hover:border-zinc-500 transition-all duration-300 relative">
            <div className="space-y-[var(--px-16)]">
              <div>
                <span className="text-[length:var(--px-9)] uppercase tracking-wider font-fira opacity-50 block mb-[var(--px-2)]">Starter Tenant</span>
                <h3 className="text-[length:var(--px-18)] font-medium font-helvetica uppercase tracking-wide">Starter</h3>
              </div>
              <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
                Perfect for independent platforms, startups, and developers looking to deploy early stage sound searching.
              </p>
              
              <div className="border-t border-b border-slate-200 border-dotted py-[var(--px-16)] space-y-[var(--px-2)]">
                <div className="flex items-baseline gap-[var(--px-2)]">
                  <span className="text-[length:var(--px-16)] font-light font-helvetica">€</span>
                  <span className="text-[length:var(--px-32)] leading-none font-medium font-helvetica tracking-tight">{starterPrice}</span>
                  <span className="text-[length:var(--px-10)] opacity-60 font-helvetica font-extralight">/ mo</span>
                </div>
                <span className="text-[length:var(--px-9)] font-fira opacity-50 block">
                  {isAnnual ? `Billed annually (€${starterTotal}/yr)` : "Billed monthly"}
                </span>
              </div>

              <ul className="space-y-[var(--px-10)]">
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Up to 5,000 tracks ingested</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Up to 5,000 API calls / month</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Standard similarity indexing</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CrossMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)] opacity-60 line-through">Silo namespace</span>
                </li>
              </ul>
            </div>
            <div className="mt-[var(--px-20)]">
              <ButtonSleek
                text="Get Starter Key"
                onClick={() => { window.location.href = "/partners#developer-form"; }}
                customWidth="w-full"
                transparent={true}
              />
            </div>
          </div>

          {/* GROWTH CARD */}
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-[var(--color-primary)] rounded-[var(--px-8)] p-[var(--px-20)] flex flex-col justify-between hover:border-[var(--color-primary-hover)] transition-all duration-300 relative">
            <div className="absolute top-[var(--px-10)] right-[var(--px-10)] bg-[var(--color-primary)] text-[var(--color-secondary)] text-[length:var(--px-8)] font-helvetica font-medium px-[var(--px-8)] py-[2px] rounded uppercase tracking-wider">
              Most Popular
            </div>
            
            <div className="space-y-[var(--px-16)]">
              <div>
                <span className="text-[length:var(--px-9)] uppercase tracking-wider font-fira opacity-50 block mb-[var(--px-2)]">Growth Tenant</span>
                <h3 className="text-[length:var(--px-18)] font-medium font-helvetica uppercase tracking-wide">Growth</h3>
              </div>
              <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-90">
                Designed for high volume music agencies, commercial audio platforms, and distributors.
              </p>
              
              <div className="border-t border-b border-slate-200 border-dotted py-[var(--px-16)] space-y-[var(--px-2)]">
                <div className="flex items-baseline gap-[var(--px-2)]">
                  <span className="text-[length:var(--px-16)] font-light font-helvetica">€</span>
                  <span className="text-[length:var(--px-32)] leading-none font-medium font-helvetica tracking-tight">{growthPrice}</span>
                  <span className="text-[length:var(--px-10)] opacity-60 font-helvetica font-extralight">/ mo</span>
                </div>
                <span className="text-[length:var(--px-9)] font-fira opacity-50 block">
                  {isAnnual ? `Billed annually (€${growthTotal}/yr)` : "Billed monthly"}
                </span>
              </div>

              <ul className="space-y-[var(--px-10)]">
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Up to 100,000 tracks ingested</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Up to 100,000 API calls / month</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Priority index updates</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Dedicated tenant routing</span>
                </li>
              </ul>
            </div>
            <div className="mt-[var(--px-20)]">
              <ButtonSleek
                text="Get Growth Key"
                onClick={() => { window.location.href = "/partners#developer-form"; }}
                customWidth="w-full"
                transparent={true}
              />
            </div>
          </div>

          {/* ENTERPRISE CARD */}
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted rounded-[var(--px-8)] p-[var(--px-20)] flex flex-col justify-between hover:border-zinc-500 transition-all duration-300 relative">
            <div className="space-y-[var(--px-16)]">
              <div>
                <span className="text-[length:var(--px-9)] uppercase tracking-wider font-fira opacity-50 block mb-[var(--px-2)]">Isolated Namespace</span>
                <h3 className="text-[length:var(--px-18)] font-medium font-helvetica uppercase tracking-wide">Enterprise</h3>
              </div>
              <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
                For enterprise publishers needing complete legal namespace isolation, high volumes, and SLAs.
              </p>
              
              <div className="border-t border-b border-slate-200 border-dotted py-[var(--px-16)] space-y-[var(--px-2)]">
                <div className="flex items-baseline gap-[var(--px-2)]">
                  <span className="text-[length:var(--px-32)] leading-none font-medium font-helvetica tracking-tight">Custom</span>
                </div>
                <span className="text-[length:var(--px-9)] font-fira opacity-50 block">
                  Annual custom contract agreements
                </span>
              </div>

              <ul className="space-y-[var(--px-10)]">
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Silo namespace isolation</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Unlimited tracks & API calls</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">99.9% Latency & Uptime SLA</span>
                </li>
                <li className="flex items-center gap-[var(--px-8)]">
                  <CheckMark />
                  <span className="font-helvetica font-extralight text-[length:var(--px-12)]">Dedicated support engineer</span>
                </li>
              </ul>
            </div>
            <div className="mt-[var(--px-20)]">
              <ButtonSleek
                text="Contact Enterprise"
                onClick={() => { window.location.href = "/partners#developer-form"; }}
                customWidth="w-full"
                transparent={true}
              />
            </div>
          </div>

        </div>

        {/* PRICING FOOTER NOTE */}
        <div className="text-center text-[length:var(--px-10)] opacity-50 font-fira tracking-wider pt-[var(--px-16)] uppercase flex items-center justify-center gap-[var(--px-8)]">
          <img src={SoundWaves} className="w-[var(--px-24)] h-[var(--px-18)] opacity-30" alt="" />
          <span>All plans are governed by the Resomix B2B Services Agreement</span>
          <img src={SoundWaves} className="w-[var(--px-24)] h-[var(--px-18)] opacity-30" alt="" />
        </div>

      </div>
    </section>
  );
}
