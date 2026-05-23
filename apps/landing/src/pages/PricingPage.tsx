import { useState } from "react";
import SoundWaves from "../assets/icons/sound_waves.svg";

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

  // Pricing calculations: annual has 17% savings (equivalent to 10 months instead of 12 months)
  const starterPrice = isAnnual ? 82.50 : 99;
  const growthPrice = isAnnual ? 415.83 : 499;

  const starterTotal = isAnnual ? 990 : 99;
  const growthTotal = isAnnual ? 4990 : 499;

  return (
    <div className="bg-black text-white min-h-screen py-16 px-4 md:px-8 select-none font-sans overflow-hidden relative">
      {/* Sound wave background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
        <div className="w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,var(--color-neon-orange)_0%,transparent_70%)] blur-3xl transform translate-y-1/4"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-16">
        
        {/* HEADER SECTION */}
        <div className="text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <span className="text-xs uppercase tracking-widest font-benzin text-[var(--color-neon-orange)] bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              Pricing Plans
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-widest font-benzin uppercase block">
              B2B PRICING TIERS
            </h1>
            <p className="text-lg md:text-xl font-light text-zinc-400 max-w-2xl leading-relaxed uppercase tracking-wide">
              Scale your sound matches logically. Choose a plan that matches your catalogue size.
            </p>
          </div>
        </div>

        {/* ANNUAL / MONTHLY TOGGLE SELECTOR */}
        <div className="flex justify-center items-center gap-4">
          <span className={`text-sm uppercase tracking-wider font-semibold ${!isAnnual ? "text-white" : "text-zinc-500"}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-16 h-8 rounded-full bg-zinc-900 border border-zinc-800 p-1 flex items-center relative transition-all duration-300"
          >
            <div
              className={`h-6 w-6 rounded-full bg-[var(--color-neon-orange)] shadow-lg transform transition-transform duration-300 ${
                isAnnual ? "translate-x-8" : "translate-x-0"
              }`}
            ></div>
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-sm uppercase tracking-wider font-semibold ${isAnnual ? "text-white" : "text-zinc-500"}`}>
              Annually
            </span>
            <span className="text-[10px] font-benzin bg-[var(--color-neon-orange)] text-white px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">
              Save 17% (2 Months Free)
            </span>
          </div>
        </div>

        {/* PRICING GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-6">
          
          {/* STARTER CARD */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-8 flex flex-col justify-between hover:border-zinc-800 transition-all backdrop-blur-sm relative group">
            <div className="space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider font-benzin text-zinc-500 block mb-1">Starter Tenant</span>
                <h3 className="text-2xl font-bold font-benzin uppercase tracking-wider">Starter</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Perfect for independent platforms, startups, and developers looking to deploy early stage sound searching.
              </p>
              <div className="border-t border-b border-zinc-900 py-6 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-light">€</span>
                  <span className="text-5xl font-bold tracking-tight">{starterPrice}</span>
                  <span className="text-zinc-500 text-sm">/ month</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 block">
                  {isAnnual ? `Billed annually (€${starterTotal}/yr)` : "Billed monthly"}
                </span>
              </div>
              <ul className="space-y-4 text-sm text-zinc-300">
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Up to <strong>5,000</strong> tracks ingested</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Up to <strong>5,000</strong> API calls / month</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Standard FAISS indexing</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-zinc-700 text-sm">✗</span>
                  <span className="text-zinc-500 line-through">Silo MySQL namespace</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => { window.location.href = "/partners#developer-form" }}
              className="mt-8 w-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 text-white font-benzin uppercase text-xs py-3.5 rounded transition-all tracking-wider font-semibold"
            >
              Get Starter Key
            </button>
          </div>

          {/* GROWTH CARD (GLOWING BORDER / RECOMMENDED) */}
          <div className="bg-zinc-950 border-2 border-[var(--color-neon-orange)] rounded-xl p-8 flex flex-col justify-between hover:scale-[1.02] transition-all backdrop-blur-md relative shadow-[0_0_30px_rgba(238,74,38,0.15)] group">
            <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 bg-[var(--color-neon-orange)] text-white text-[9px] font-benzin font-bold px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
              Most Popular
            </div>
            <div className="space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider font-benzin text-[var(--color-neon-orange)] block mb-1">Growth Tenant</span>
                <h3 className="text-2xl font-bold font-benzin uppercase tracking-wider">Growth</h3>
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Designed for high volume music agencies, commercial audio platforms, and scaled distributors.
              </p>
              <div className="border-t border-b border-zinc-900 py-6 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-light">€</span>
                  <span className="text-5xl font-bold tracking-tight text-[var(--color-neon-orange)]">{growthPrice}</span>
                  <span className="text-zinc-500 text-sm">/ month</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 block">
                  {isAnnual ? `Billed annually (€${growthTotal}/yr)` : "Billed monthly"}
                </span>
              </div>
              <ul className="space-y-4 text-sm text-zinc-200">
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Up to <strong>100,000</strong> tracks ingested</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Up to <strong>100,000</strong> API calls / month</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Priority FAISS index updates</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Dedicated tenant routing</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => { window.location.href = "/partners#developer-form" }}
              className="mt-8 w-full bg-[var(--color-neon-orange)] hover:bg-red-600 text-white font-benzin uppercase text-xs py-4 rounded transition-all tracking-wider font-bold shadow-lg"
            >
              Get Growth Key
            </button>
          </div>

          {/* ENTERPRISE CARD */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-8 flex flex-col justify-between hover:border-zinc-800 transition-all backdrop-blur-sm relative group">
            <div className="space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider font-benzin text-zinc-500 block mb-1">Isolated Namespace</span>
                <h3 className="text-2xl font-bold font-benzin uppercase tracking-wider">Enterprise</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                For enterprise publishers needing complete legal namespace isolation, high volume limits, and custom SLAs.
              </p>
              <div className="border-t border-b border-zinc-900 py-6 space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">Custom</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 block">
                  Annual custom contract agreements
                </span>
              </div>
              <ul className="space-y-4 text-sm text-zinc-300">
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span><strong>Silo MySQL/FAISS namespace</strong></span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Unlimited tracks & API calls</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>99.9% Latency & Uptime SLA</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-[var(--color-neon-orange)] text-sm">✓</span>
                  <span>Dedicated dev support engineer</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => { window.location.href = "/partners#developer-form" }}
              className="mt-8 w-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 text-white font-benzin uppercase text-xs py-3.5 rounded transition-all tracking-wider font-semibold"
            >
              Contact Enterprise
            </button>
          </div>

        </div>

        {/* PRICING FOOTER NOTE */}
        <div className="text-center text-xs text-zinc-500 font-mono tracking-widest pt-8 uppercase flex items-center justify-center gap-3">
          <img src={SoundWaves} className="w-8 h-6 opacity-30" alt="" />
          <span>All plans are governed by the Resomix B2B Services Agreement</span>
          <img src={SoundWaves} className="w-8 h-6 opacity-30" alt="" />
        </div>

      </div>
    </div>
  );
}
