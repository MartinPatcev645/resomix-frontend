import { useState } from "react";
import { usePartners } from "../hooks/usePartners.ts";
import { useResponsive } from "@resomix/hooks";
import { ButtonSleek, IconButton } from "@resomix/ui";

const copyIcon = (
  <svg className="w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const copyIconHover = (
  <svg className="w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-black text-black" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const checkIcon = (
  <svg className="w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-black text-black" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const ONBOARDING_STEPS = [
  {
    title: "1. Sandbox Access",
    desc: "Use our public demo key to access the Sandbox catalog containing over 700 CC BY 4.0 tracks.",
  },
  {
    title: "2. API Integration",
    desc: "Integrate our similarity search and sonic metadata extraction into your frontend or backend using curl, Python, or JavaScript.",
  },
  {
    title: "3. Evaluate Results",
    desc: "Run real-time acoustic similarity searches and feel the emotional resonance of the sound recommendations.",
  },
  {
    title: "4. Request Production Key",
    desc: "Fill out the developer registration form on this portal to request a production tier matching your catalog scale.",
  },
  {
    title: "5. Setup Dedicated Namespace",
    desc: "Enterprise partners receive a dedicated, logically isolated namespace for complete compliance and security.",
  },
  {
    title: "6. Catalogue Ingestion",
    desc: "Deliver your music catalog via our secure SFTP pipeline.",
  },
  {
    title: "7. Embedding & Indexing",
    desc: "Our automated pipeline converts your tracks into high-dimensional audio embeddings and sets up similarity indices.",
  },
  {
    title: "8. Go Live",
    desc: "Deploy production sound similarity searches to your customers.",
  },
];

export default function PartnersPage() {
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    return <PartnersDesktop />;
  } else {
    return <PartnersMobile />;
  }
}

// ─── DESKTOP PLATFORM VIEW (Viewport >= 1024px) ──────────────────────────────
function PartnersDesktop() {
  const {
    formData,
    isSubmitting,
    isSuccess,
    errorMessage,
    setIsSuccess,
    handleInputChange,
    handleFormSubmit,
  } = usePartners();

  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [copyKeySuccess, setCopyKeySuccess] = useState(false);
  const [copyCurlSuccess, setCopyCurlSuccess] = useState(false);

  const handleCopy = async (text: string, type: "key" | "curl") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "key") {
        setCopyKeySuccess(true);
        setTimeout(() => setCopyKeySuccess(false), 2000);
      } else {
        setCopyCurlSuccess(true);
        setTimeout(() => setCopyCurlSuccess(false), 2000);
      }
    } catch (e) {
      // Fallback
    }
  };

  const sandboxKey = "rmx_sandbox_demo";
  const sandboxCurl = `curl -X POST "https://sandbox.resomix.com/v1/similarity/query" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${sandboxKey}" \\
  -d '{"track_id": "719ea12f-cdc4-40d4-b33a-753b389dfad5", "limit": 20}'`;

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
              B2B PARTNERS
            </h1>
            <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
              Unbounded sound similarity, isolated namespaces, premium delivery.
            </p>
          </div>
        </header>

        {/* CORE VALUE PROPOSITIONS */}
        <div className="grid grid-cols-3 gap-[var(--px-20)]">
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted p-[var(--px-24)] rounded-[var(--px-10)] relative hover:border-zinc-500 transition-all duration-300 group flex flex-col justify-between">
            <div className="absolute top-[var(--px-12)] right-[var(--px-12)] text-[length:var(--px-10)] font-fira text-zinc-600 group-hover:text-[var(--color-primary)] transition-colors">01</div>
            <div>
              <h3 className="text-[length:var(--px-16)] font-medium font-helvetica uppercase tracking-wider mb-[var(--px-10)]">Logical Isolation</h3>
              <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-80">
                We guarantee absolute data sovereignty with fully isolated, single-tenant namespaces matching enterprise policies.
              </p>
            </div>
          </div>
          
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted p-[var(--px-24)] rounded-[var(--px-10)] relative hover:border-zinc-500 transition-all duration-300 group flex flex-col justify-between">
            <div className="absolute top-[var(--px-12)] right-[var(--px-12)] text-[length:var(--px-10)] font-fira text-zinc-600 group-hover:text-[var(--color-primary)] transition-colors">02</div>
            <div>
              <h3 className="text-[length:var(--px-16)] font-medium font-helvetica uppercase tracking-wider mb-[var(--px-10)]">Ultra-Low Latency</h3>
              <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-80">
                Our sound indices run preloaded in memory to return hyper-accurate sound match vectors globally.
              </p>
            </div>
          </div>

          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted p-[var(--px-24)] rounded-[var(--px-10)] relative hover:border-zinc-500 transition-all duration-300 group flex flex-col justify-between">
            <div className="absolute top-[var(--px-12)] right-[var(--px-12)] text-[length:var(--px-10)] font-fira text-zinc-600 group-hover:text-[var(--color-primary)] transition-colors">03</div>
            <div>
              <h3 className="text-[length:var(--px-16)] font-medium font-helvetica uppercase tracking-wider mb-[var(--px-10)]">Acoustic Search</h3>
              <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-80">
                Deliver recommendations purely based on auditory attributes and emotional signatures, rather than crowdsourced tag metadata.
              </p>
            </div>
          </div>
        </div>

        {/* INTERACTIVE VIDEO DEMO */}
        <div className="grid grid-cols-2 gap-[var(--px-40)] items-center border border-slate-200 border-dotted p-[var(--px-30)] rounded-[var(--px-10)] bg-[var(--color-primary-background)]/10 backdrop-blur-sm">
          <div className="space-y-[var(--px-20)]">
            <span className="text-[length:var(--px-10)] uppercase tracking-wider font-fira text-[var(--color-primary)] opacity-60 block">Interactive Demo</span>
            <h2 className="text-[length:var(--px-30)] font-medium font-helvetica uppercase leading-tight">60-Second Video Walkthrough</h2>
            <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-80">
              Explore how Resomix transforms standard audio catalogue archives into indexed vectors. Watch our platform in action, demonstrating live ingestion pipelines, real-time embedding generation, and acoustic similarity lookups.
            </p>
            <div className="flex items-center gap-[var(--px-8)] text-zinc-400">
              <span className="h-[var(--px-6)] w-[var(--px-6)] rounded-full bg-[var(--color-primary)] animate-ping animate-duration-[1200ms] block"></span>
              <span className="text-[length:var(--px-10)] font-fira">Press play to begin preview</span>
            </div>
          </div>

          <div className="relative group rounded-[var(--px-10)] overflow-hidden border border-slate-200 border-dotted bg-[var(--color-secondary)] aspect-video flex items-center justify-center cursor-pointer shadow-2xl">
            {/* Play button overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 transition-opacity group-hover:opacity-90"></div>
            
            {/* Visual audio visualizer effect behind play button */}
            <div className="absolute w-[var(--px-80)] h-[var(--px-80)] rounded-full bg-[var(--color-primary)]/10 scale-95 group-hover:scale-110 transition-transform duration-500 blur-md"></div>
            
            <div className="relative z-20 flex flex-col items-center justify-center space-y-[var(--px-12)]">
              <div className="w-[var(--px-50)] h-[var(--px-50)] rounded-full bg-[var(--color-primary)] text-[var(--color-secondary)] flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-xl">
                <svg className="w-[var(--px-20)] h-[var(--px-20)] fill-current translate-x-[2px]" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-[length:var(--px-10)] font-helvetica uppercase tracking-wider opacity-85">Play B2B Pipeline Walkthrough</span>
            </div>

            <div className="absolute bottom-[var(--px-12)] left-[var(--px-12)] z-20 flex items-center gap-[var(--px-8)]">
              <span className="text-[length:var(--px-9)] font-fira bg-[#222222] text-[#B9B9B9] px-[var(--px-6)] py-[2px] rounded">01:00</span>
              <span className="text-[length:var(--px-9)] font-fira bg-[var(--color-primary)] text-[var(--color-secondary)] px-[var(--px-6)] py-[2px] rounded uppercase tracking-wider">HD</span>
            </div>
          </div>
        </div>

        {/* ONBOARDING MILESTONES CAROUSEL */}
        <div className="border border-slate-200 border-dotted rounded-[var(--px-10)] p-[var(--px-30)] space-y-[var(--px-24)] bg-[var(--color-primary-background)]/10 backdrop-blur-sm">
          <div className="flex justify-between items-center gap-[var(--px-16)]">
            <div className="space-y-[var(--px-4)]">
              <span className="text-[length:var(--px-10)] uppercase tracking-wider font-fira text-[var(--color-primary)] opacity-60 block">Partnership Flow</span>
              <h2 className="text-[length:var(--px-26)] font-medium font-helvetica uppercase mt-1">8-Slide Onboarding Journey</h2>
            </div>
            <div className="flex items-center gap-[var(--px-8)]">
              <button 
                type="button"
                onClick={() => setActiveCarouselIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeCarouselIndex === 0}
                className="px-[var(--px-12)] py-[var(--px-6)] border border-slate-200 border-dotted rounded-[var(--px-4)] bg-[var(--color-primary-background)]/80 hover:bg-zinc-800 disabled:opacity-30 transition-all text-[length:var(--px-11)] font-helvetica uppercase"
              >
                ← Prev
              </button>
              <span className="text-[length:var(--px-11)] font-fira px-[var(--px-8)] opacity-60">
                {activeCarouselIndex + 1} / 8
              </span>
              <button 
                type="button"
                onClick={() => setActiveCarouselIndex((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1))}
                disabled={activeCarouselIndex === ONBOARDING_STEPS.length - 1}
                className="px-[var(--px-12)] py-[var(--px-6)] border border-slate-200 border-dotted rounded-[var(--px-4)] bg-[var(--color-primary-background)]/80 hover:bg-zinc-800 disabled:opacity-30 transition-all text-[length:var(--px-11)] font-helvetica uppercase"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="relative min-h-[var(--px-140)] bg-[var(--color-secondary)]/50 border border-slate-200 border-dotted rounded-[var(--px-10)] p-[var(--px-20)] flex flex-col justify-center">
            <div className="space-y-[var(--px-8)]">
              <h4 className="text-[length:var(--px-15)] font-medium uppercase tracking-wider font-helvetica text-[var(--color-primary)]">
                {ONBOARDING_STEPS[activeCarouselIndex].title}
              </h4>
              <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-85">
                {ONBOARDING_STEPS[activeCarouselIndex].desc}
              </p>
            </div>
          </div>

          {/* Carousel dots indicator */}
          <div className="flex justify-center gap-[var(--px-6)]">
            {ONBOARDING_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveCarouselIndex(idx)}
                className={`h-[var(--px-4)] rounded-full transition-all duration-300 ${
                  activeCarouselIndex === idx ? "w-[var(--px-24)] bg-[var(--color-primary)]" : "w-[var(--px-6)] bg-[#222222] hover:bg-[#50504F]"
                }`}
              ></button>
            ))}
          </div>
        </div>

        {/* TRY SANDBOX CTA */}
        <div className="grid grid-cols-2 gap-[var(--px-40)] border border-slate-200 border-dotted rounded-[var(--px-10)] bg-gradient-to-br from-zinc-950/20 via-zinc-950/40 to-zinc-950/20 p-[var(--px-30)] backdrop-blur-sm relative overflow-hidden">
          <div className="space-y-[var(--px-16)] self-center">
            <span className="text-[length:var(--px-10)] uppercase tracking-wider font-fira text-[var(--color-primary)] opacity-60 block">Developer Sandbox</span>
            <h2 className="text-[length:var(--px-26)] font-medium font-helvetica uppercase leading-[var(--px-32)]">Try the Sandbox Catalog</h2>
            <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-80">
              Skip waitlists and begin querying instantly using our public Sandbox API Key. Access the seeded partner tenant loaded with 700+ CC BY 4.0 acoustically distinct tracks.
            </p>
            <div className="space-y-[var(--px-8)]">
              <span className="text-[length:var(--px-10)] uppercase tracking-wider opacity-60 font-fira block">Credentials</span>
              <div className="flex gap-[var(--px-12)] items-stretch">
                <div className="bg-[var(--color-secondary)] px-[var(--px-12)] py-[var(--px-8)] rounded-[var(--px-4)] border border-slate-200 border-dotted font-mono text-[length:var(--px-11)] flex-1 flex items-center justify-between overflow-x-auto text-[var(--color-primary)]">
                  <code>{sandboxKey}</code>
                </div>
                <IconButton
                  text={copyKeySuccess ? "Copied!" : "Copy Key"}
                  onClick={() => handleCopy(sandboxKey, "key")}
                  icon={copyKeySuccess ? checkIcon : copyIcon}
                  hoverIcon={copyKeySuccess ? checkIcon : copyIconHover}
                  transparent={true}
                  customWidth="min-w-[var(--px-120)]"
                  className="h-[var(--px-36)]"
                />
              </div>
            </div>

            {/* See Full Documentation Button */}
            <div className="pt-[var(--px-4)]">
              <ButtonSleek
                text="See Full Documentation"
                onClick={() => { window.open("https://api-docs.resomix.com/", "_blank"); }}
                transparent={true}
                customWidth="w-full"
              />
            </div>
          </div>

          <div className="bg-[var(--color-secondary)] border border-slate-200 border-dotted rounded-[var(--px-10)] p-[var(--px-20)] font-fira text-[length:var(--px-11)] text-[#B9B9B9] space-y-[var(--px-10)] relative select-text overflow-x-auto">
            <div className="absolute top-[var(--px-12)] right-[var(--px-12)] text-[length:var(--px-9)] font-helvetica font-light uppercase opacity-60 border border-slate-200 border-dotted px-[var(--px-6)] py-[2px] rounded bg-[#222222]">
              Interactive curl
            </div>
            <span className="opacity-60 font-helvetica text-[length:var(--px-9)] uppercase block mb-[var(--px-4)]">Similarity Lookup</span>
            <pre className="text-[#B9B9B9] leading-relaxed overflow-x-auto">
              {sandboxCurl}
            </pre>
            <div className="flex justify-start mt-[var(--px-12)]">
              <IconButton
                text={copyCurlSuccess ? "Copied!" : "Copy Curl"}
                onClick={() => handleCopy(sandboxCurl, "curl")}
                icon={copyCurlSuccess ? checkIcon : copyIcon}
                hoverIcon={copyCurlSuccess ? checkIcon : copyIconHover}
                transparent={true}
                customWidth="min-w-[var(--px-120)]"
                className="h-[var(--px-32)]"
              />
            </div>
          </div>
        </div>

        {/* DEVELOPER PRODUCTION REGISTRATION FORM */}
        <div className="border border-slate-200 border-dotted rounded-[var(--px-10)] p-[var(--px-30)] space-y-[var(--px-32)] bg-[var(--color-primary-background)]/10 backdrop-blur-md" id="developer-form">
          <div className="text-center max-w-[var(--px-600)] mx-auto space-y-[var(--px-8)]">
            <span className="text-[length:var(--px-10)] uppercase tracking-wider font-fira text-[var(--color-primary)] opacity-60 block">Get Production Access</span>
            <h2 className="text-[length:var(--px-26)] font-medium font-helvetica uppercase">Developer Portal Form</h2>
            <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-18)] opacity-80">
              Ready to deploy Resomix search queries on your main commercial catalogs? Submit your estimated volumes below to generate an authorization request routed to our partner team.
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-[var(--color-secondary)] border border-slate-200 border-dotted rounded-[var(--px-10)] p-[var(--px-30)] text-center max-w-[var(--px-450)] mx-auto space-y-[var(--px-16)]">
              <div className="w-[var(--px-40)] h-[var(--px-40)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto text-[length:var(--px-16)] font-bold">✓</div>
              <h4 className="text-[length:var(--px-18)] font-medium font-helvetica uppercase">Request Generated</h4>
              <p className="text-[length:var(--px-13)] font-extralight font-helvetica leading-[var(--px-17)] opacity-80">
                Your B2B Partner API request was successfully generated! If your native email client did not launch, please send your details to <a href="mailto:partners@resomix.com" className="text-[var(--color-primary-hover)] hover:underline">partners@resomix.com</a>.
              </p>
              <ButtonSleek
                text="Submit Another Request"
                onClick={() => setIsSuccess(false)}
                customWidth="w-full"
              />
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="max-w-[var(--px-700)] mx-auto grid grid-cols-2 gap-[var(--px-20)] select-text">
              <div className="flex flex-col items-start gap-[var(--px-8)]">
                <label className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica uppercase">Company / Legal Name *</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  placeholder="e.g. Acme Audio B.V."
                  className="w-full border border-slate-200 border-dotted p-[var(--px-10)] text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica bg-transparent text-[var(--color-primary)] placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-col items-start gap-[var(--px-8)]">
                <label className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica uppercase">Contact Name *</label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleInputChange}
                  placeholder="e.g. Alex Carter"
                  className="w-full border border-slate-200 border-dotted p-[var(--px-10)] text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica bg-transparent text-[var(--color-primary)] placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-col items-start gap-[var(--px-8)]">
                <label className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica uppercase">Contact Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleInputChange}
                  placeholder="e.g. alex@acme.com"
                  className="w-full border border-slate-200 border-dotted p-[var(--px-10)] text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica bg-transparent text-[var(--color-primary)] placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-col items-start gap-[var(--px-8)]">
                <label className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica uppercase">Preferred Tier</label>
                <select
                  name="estimatedCalls"
                  value={formData.estimatedCalls}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 border-dotted p-[var(--px-10)] text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica bg-[var(--color-primary-background)] text-[var(--color-primary)] focus:outline-none"
                >
                  <option value="" className="bg-[var(--color-primary-background)]">Select a tier...</option>
                  <option value="Starter Tier (€99/mo)" className="bg-[var(--color-primary-background)]">Starter (€99/mo)</option>
                  <option value="Growth Tier (€499/mo)" className="bg-[var(--color-primary-background)]">Growth (€499/mo)</option>
                  <option value="Enterprise Tier (Contact)" className="bg-[var(--color-primary-background)]">Enterprise (Silo Namespace)</option>
                </select>
              </div>

              <div className="flex flex-col items-start gap-[var(--px-8)] md:col-span-2">
                <label className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica uppercase">Acoustic Catalogue Size / Use Case</label>
                <textarea
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Describe your catalogue scale, required query volumes, and why sound similarity is core to your platform..."
                  className="w-full border border-slate-200 border-dotted p-[var(--px-10)] text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica bg-transparent text-[var(--color-primary)] placeholder-zinc-700 focus:outline-none resize-none"
                />
              </div>

              {errorMessage && (
                <div className="md:col-span-2 text-[length:var(--px-11)] font-medium text-red-500 uppercase tracking-wider">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="md:col-span-2 flex justify-center mt-[var(--px-10)]">
                <ButtonSleek
                  text={isSubmitting ? "Generating Request..." : "Request Production Key"}
                  onClick={(e) => {
                    e.preventDefault();
                    handleFormSubmit(e as any);
                  }}
                  disabled={isSubmitting}
                  customWidth="w-full max-w-[var(--px-300)]"
                />
              </div>
            </form>
          )}
        </div>

      </div>
    </section>
  );
}

// ─── MOBILE PLATFORM VIEW (Viewport < 1024px) ────────────────────────────────
function PartnersMobile() {
  const {
    formData,
    isSubmitting,
    isSuccess,
    errorMessage,
    setIsSuccess,
    handleInputChange,
    handleFormSubmit,
  } = usePartners();

  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [copyKeySuccess, setCopyKeySuccess] = useState(false);
  const [copyCurlSuccess, setCopyCurlSuccess] = useState(false);

  const handleCopy = async (text: string, type: "key" | "curl") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "key") {
        setCopyKeySuccess(true);
        setTimeout(() => setCopyKeySuccess(false), 2000);
      } else {
        setCopyCurlSuccess(true);
        setTimeout(() => setCopyCurlSuccess(false), 2000);
      }
    } catch (e) {
      // Fallback
    }
  };

  const sandboxKey = "rmx_sandbox_demo";
  const sandboxCurl = `curl -X POST "https://sandbox.resomix.com/v1/similarity/query" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${sandboxKey}" \\
  -d '{"track_id": "719ea12f-cdc4-40d4-b33a-753b389dfad5", "limit": 20}'`;

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
              B2B PARTNERS
            </h1>
            <p className="mt-[var(--px-8)] text-[length:var(--px-12)] font-extralight lg:opacity-80 font-helvetica">
              Unbounded sound similarity, isolated namespaces, premium delivery.
            </p>
          </div>
        </header>

        {/* CORE VALUE PROPOSITIONS */}
        <div className="flex flex-col gap-[var(--px-16)]">
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted p-[var(--px-20)] rounded-[var(--px-8)] relative group">
            <div className="absolute top-[var(--px-12)] right-[var(--px-12)] text-[length:var(--px-9)] font-fira text-zinc-600">01</div>
            <h3 className="text-[length:var(--px-14)] font-medium font-helvetica uppercase tracking-wider mb-[var(--px-8)]">Logical Isolation</h3>
            <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
              We guarantee absolute data sovereignty with fully isolated, single-tenant namespaces matching enterprise policies.
            </p>
          </div>
          
          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted p-[var(--px-20)] rounded-[var(--px-8)] relative group">
            <div className="absolute top-[var(--px-12)] right-[var(--px-12)] text-[length:var(--px-9)] font-fira text-zinc-600">02</div>
            <h3 className="text-[length:var(--px-14)] font-medium font-helvetica uppercase tracking-wider mb-[var(--px-8)]">Ultra-Low Latency</h3>
            <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
              Our sound indices run preloaded in memory to return hyper-accurate sound match vectors globally.
            </p>
          </div>

          <div className="bg-[var(--color-primary-background)]/30 backdrop-blur-md border border-slate-200 border-dotted p-[var(--px-20)] rounded-[var(--px-8)] relative group">
            <div className="absolute top-[var(--px-12)] right-[var(--px-12)] text-[length:var(--px-9)] font-fira text-zinc-600">03</div>
            <h3 className="text-[length:var(--px-14)] font-medium font-helvetica uppercase tracking-wider mb-[var(--px-8)]">Acoustic Search</h3>
            <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
              Deliver recommendations purely based on auditory attributes and emotional signatures, rather than crowdsourced tag metadata.
            </p>
          </div>
        </div>

        {/* INTERACTIVE VIDEO DEMO */}
        <div className="flex flex-col gap-[var(--px-24)] border border-slate-200 border-dotted p-[var(--px-20)] rounded-[var(--px-8)] bg-[var(--color-primary-background)]/10 backdrop-blur-sm">
          <div className="space-y-[var(--px-12)]">
            <span className="text-[length:var(--px-9)] uppercase tracking-wider font-fira text-[var(--color-primary)] opacity-60 block">Interactive Demo</span>
            <h2 className="text-[length:var(--px-20)] font-medium font-helvetica uppercase leading-tight">60-Second Video Walkthrough</h2>
            <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
              Explore how Resomix transforms standard audio catalogue archives into indexed vectors. Watch our platform in action, demonstrating live ingestion pipelines, real-time embedding generation, and acoustic similarity lookups.
            </p>
            <div className="flex items-center gap-[var(--px-6)] text-zinc-400">
              <span className="h-[var(--px-4)] w-[var(--px-4)] rounded-full bg-[var(--color-primary)] animate-ping animate-duration-[1200ms] block"></span>
              <span className="text-[length:var(--px-9)] font-fira">Press play to begin preview</span>
            </div>
          </div>

          <div className="relative group rounded-[var(--px-8)] overflow-hidden border border-slate-200 border-dotted bg-[var(--color-secondary)] aspect-video flex items-center justify-center cursor-pointer shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10"></div>
            <div className="absolute w-[var(--px-60)] h-[var(--px-60)] rounded-full bg-[var(--color-primary)]/10 scale-95 blur-md"></div>
            <div className="relative z-20 flex flex-col items-center justify-center space-y-[var(--px-8)]">
              <div className="w-[var(--px-40)] h-[var(--px-40)] rounded-full bg-[var(--color-primary)] text-[var(--color-secondary)] flex items-center justify-center shadow-xl">
                <svg className="w-[var(--px-16)] h-[var(--px-16)] fill-current translate-x-[2px]" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-[length:var(--px-9)] font-helvetica uppercase tracking-wider opacity-85">Play Walkthrough</span>
            </div>
            <div className="absolute bottom-[var(--px-8)] left-[var(--px-8)] z-20 flex items-center gap-[var(--px-6)]">
              <span className="text-[length:var(--px-8)] font-fira bg-[#222222] text-[#B9B9B9] px-[var(--px-4)] py-[1px] rounded">01:00</span>
              <span className="text-[length:var(--px-8)] font-fira bg-[var(--color-primary)] text-[var(--color-secondary)] px-[var(--px-4)] py-[1px] rounded uppercase tracking-wider">HD</span>
            </div>
          </div>
        </div>

        {/* ONBOARDING MILESTONES CAROUSEL */}
        <div className="border border-slate-200 border-dotted rounded-[var(--px-8)] p-[var(--px-20)] space-y-[var(--px-20)] bg-[var(--color-primary-background)]/10 backdrop-blur-sm">
          <div className="flex flex-col gap-[var(--px-12)]">
            <span className="text-[length:var(--px-9)] uppercase tracking-wider font-fira text-[var(--color-primary)] opacity-60 block">Partnership Flow</span>
            <h2 className="text-[length:var(--px-20)] font-medium font-helvetica uppercase">Onboarding Journey</h2>
          </div>

          <div className="relative min-h-[var(--px-150)] bg-[var(--color-secondary)]/50 border border-slate-200 border-dotted rounded-[var(--px-8)] p-[var(--px-16)] flex flex-col justify-center">
            <div className="space-y-[var(--px-6)]">
              <h4 className="text-[length:var(--px-13)] font-medium uppercase tracking-wider font-helvetica text-[var(--color-primary)]">
                {ONBOARDING_STEPS[activeCarouselIndex].title}
              </h4>
              <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-85">
                {ONBOARDING_STEPS[activeCarouselIndex].desc}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-[var(--px-4)]">
            <div className="flex gap-[var(--px-4)]">
              {ONBOARDING_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveCarouselIndex(idx)}
                  className={`h-[var(--px-4)] rounded-full transition-all duration-300 ${
                    activeCarouselIndex === idx ? "w-[var(--px-16)] bg-[var(--color-primary)]" : "w-[var(--px-4)] bg-[#222222]"
                  }`}
                ></button>
              ))}
            </div>
            <div className="flex items-center gap-[var(--px-4)]">
              <button 
                type="button"
                onClick={() => setActiveCarouselIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeCarouselIndex === 0}
                className="px-[var(--px-8)] py-[var(--px-4)] border border-slate-200 border-dotted rounded-[var(--px-4)] bg-[var(--color-primary-background)]/80 disabled:opacity-30 text-[length:var(--px-10)] font-helvetica uppercase"
              >
                ←
              </button>
              <span className="text-[length:var(--px-10)] font-fira opacity-60">
                {activeCarouselIndex + 1}/8
              </span>
              <button 
                type="button"
                onClick={() => setActiveCarouselIndex((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1))}
                disabled={activeCarouselIndex === ONBOARDING_STEPS.length - 1}
                className="px-[var(--px-8)] py-[var(--px-4)] border border-slate-200 border-dotted rounded-[var(--px-4)] bg-[var(--color-primary-background)]/80 disabled:opacity-30 text-[length:var(--px-10)] font-helvetica uppercase"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* TRY SANDBOX CTA */}
        <div className="flex flex-col gap-[var(--px-24)] border border-slate-200 border-dotted rounded-[var(--px-8)] p-[var(--px-20)] bg-gradient-to-br from-zinc-950/20 via-zinc-950/40 to-zinc-950/20 backdrop-blur-sm">
          <div className="space-y-[var(--px-12)]">
            <span className="text-[length:var(--px-9)] uppercase tracking-wider font-fira text-[var(--color-primary)] opacity-60 block">Developer Sandbox</span>
            <h2 className="text-[length:var(--px-20)] font-medium font-helvetica uppercase leading-tight">Try the Sandbox Catalog</h2>
            <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
              Skip waitlists and begin querying instantly using our public Sandbox API Key. Access the seeded partner tenant loaded with 700+ CC BY 4.0 acoustically distinct tracks.
            </p>
            <div className="space-y-[var(--px-6)]">
              <span className="text-[length:var(--px-9)] uppercase tracking-wider opacity-60 font-fira block">Credentials</span>
              <div className="flex flex-col gap-[var(--px-8)]">
                <div className="bg-[var(--color-secondary)] px-[var(--px-10)] py-[var(--px-6)] rounded-[var(--px-4)] border border-slate-200 border-dotted font-mono text-[length:var(--px-10)] flex items-center justify-between overflow-x-auto text-[var(--color-primary)]">
                  <code>{sandboxKey}</code>
                </div>
                <IconButton
                  text={copyKeySuccess ? "Copied!" : "Copy Key"}
                  onClick={() => handleCopy(sandboxKey, "key")}
                  icon={copyKeySuccess ? checkIcon : copyIcon}
                  hoverIcon={copyKeySuccess ? checkIcon : copyIconHover}
                  transparent={true}
                  mobile={true}
                  customWidth="w-full"
                />
              </div>
            </div>
            {/* See Full Documentation Button */}
            <div className="pt-[var(--px-4)]">
              <ButtonSleek
                text="See Full Documentation"
                onClick={() => { window.open("https://api-docs.resomix.com/", "_blank"); }}
                transparent={true}
                customWidth="w-full"
              />
            </div>
          </div>

          <div className="bg-[var(--color-secondary)] border border-slate-200 border-dotted rounded-[var(--px-8)] p-[var(--px-12)] font-fira text-[length:var(--px-9)] text-[#B9B9B9] space-y-[var(--px-6)] overflow-x-auto relative">
            <div className="text-[length:var(--px-8)] font-helvetica font-light uppercase opacity-60 block mb-[var(--px-4)]">
              Interactive curl
            </div>
            <pre className="text-[#B9B9B9] leading-relaxed overflow-x-auto">
              {sandboxCurl}
            </pre>
            <div className="flex justify-start mt-[var(--px-8)]">
              <IconButton
                text={copyCurlSuccess ? "Copied!" : "Copy Curl"}
                onClick={() => handleCopy(sandboxCurl, "curl")}
                icon={copyCurlSuccess ? checkIcon : copyIcon}
                hoverIcon={copyCurlSuccess ? checkIcon : copyIconHover}
                transparent={true}
                mobile={true}
                customWidth="w-full"
              />
            </div>
          </div>
        </div>

        {/* DEVELOPER PRODUCTION REGISTRATION FORM */}
        <div className="border border-slate-200 border-dotted rounded-[var(--px-8)] p-[var(--px-20)] space-y-[var(--px-24)] bg-[var(--color-primary-background)]/10 backdrop-blur-md" id="developer-form">
          <div className="space-y-[var(--px-6)] text-center">
            <span className="text-[length:var(--px-9)] uppercase tracking-wider font-fira text-[var(--color-primary)] opacity-60 block">Get Production Access</span>
            <h2 className="text-[length:var(--px-20)] font-medium font-helvetica uppercase">Developer Portal Form</h2>
            <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
              Submit catalogue details below to trigger an admin onboarding workflow.
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-[var(--color-secondary)] border border-slate-200 border-dotted rounded-[var(--px-8)] p-[var(--px-20)] text-center space-y-[var(--px-12)]">
              <div className="w-[var(--px-32)] h-[var(--px-32)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto text-[length:var(--px-14)] font-bold">✓</div>
              <h4 className="text-[length:var(--px-15)] font-medium font-helvetica uppercase">Request Generated</h4>
              <p className="text-[length:var(--px-12)] font-extralight font-helvetica leading-[var(--px-16)] opacity-80">
                Email launch triggered! Or send to <a href="mailto:partners@resomix.com" className="text-[var(--color-primary-hover)] hover:underline">partners@resomix.com</a>.
              </p>
              <ButtonSleek
                text="Submit Another Request"
                onClick={() => setIsSuccess(false)}
                customWidth="w-full"
              />
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-[var(--px-16)] select-text">
              <div className="flex flex-col items-start gap-[var(--px-6)]">
                <label className="text-[length:var(--px-10)] font-extralight font-helvetica uppercase">Company / Legal Name *</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  placeholder="e.g. Acme Audio B.V."
                  className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-light font-helvetica bg-transparent text-[var(--color-primary)] placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-col items-start gap-[var(--px-6)]">
                <label className="text-[length:var(--px-10)] font-extralight font-helvetica uppercase">Contact Name *</label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleInputChange}
                  placeholder="e.g. Alex Carter"
                  className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-light font-helvetica bg-transparent text-[var(--color-primary)] placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-col items-start gap-[var(--px-6)]">
                <label className="text-[length:var(--px-10)] font-extralight font-helvetica uppercase">Contact Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleInputChange}
                  placeholder="e.g. alex@acme.com"
                  className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-light font-helvetica bg-transparent text-[var(--color-primary)] placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <div className="flex flex-col items-start gap-[var(--px-6)]">
                <label className="text-[length:var(--px-10)] font-extralight font-helvetica uppercase">Preferred Tier</label>
                <select
                  name="estimatedCalls"
                  value={formData.estimatedCalls}
                  onChange={handleInputChange}
                  className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-light font-helvetica bg-[var(--color-primary-background)] text-[var(--color-primary)] focus:outline-none"
                >
                  <option value="" className="bg-[var(--color-primary-background)]">Select a tier...</option>
                  <option value="Starter Tier (€99/mo)" className="bg-[var(--color-primary-background)]">Starter (€99/mo)</option>
                  <option value="Growth Tier (€499/mo)" className="bg-[var(--color-primary-background)]">Growth (€499/mo)</option>
                  <option value="Enterprise Tier (Contact)" className="bg-[var(--color-primary-background)]">Enterprise (Silo Namespace)</option>
                </select>
              </div>

              <div className="flex flex-col items-start gap-[var(--px-6)]">
                <label className="text-[length:var(--px-10)] font-extralight font-helvetica uppercase">Acoustic Catalogue Size / Use Case</label>
                <textarea
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Describe your catalogue scale, required query volumes..."
                  className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-light font-helvetica bg-transparent text-[var(--color-primary)] placeholder-zinc-700 focus:outline-none resize-none"
                />
              </div>

              {errorMessage && (
                <div className="text-[length:var(--px-10)] font-medium text-red-500 uppercase tracking-wider">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="flex justify-center mt-[var(--px-8)]">
                <ButtonSleek
                  text={isSubmitting ? "Generating..." : "Request Production Key"}
                  onClick={(e) => {
                    e.preventDefault();
                    handleFormSubmit(e as any);
                  }}
                  disabled={isSubmitting}
                  customWidth="w-full"
                />
              </div>
            </form>
          )}
        </div>

      </div>
    </section>
  );
}
