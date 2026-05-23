import { useState } from "react";
import { usePartners } from "../hooks/usePartners.ts";
import SoundWaves from "../assets/icons/sound_waves.svg";

const ONBOARDING_STEPS = [
  {
    title: "1. Sandbox Access",
    desc: "Use our public demo key `rmx_sandbox_demo_1234567890` to access the Sandbox catalog containing over 700 curated CC BY 4.0 tracks.",
  },
  {
    title: "2. API Integration",
    desc: "Integrate our similarity search and sonic metadata extraction into your frontend or backend using curl, Python, or JavaScript.",
  },
  {
    title: "3. Evaluate Results",
    desc: "Run real-time acoustic similarity searches and feel the emotional resonance of the curated sound recommendations.",
  },
  {
    title: "4. Request Production Key",
    desc: "Fill out the developer registration form on this portal to request a production tier matching your catalog scale.",
  },
  {
    title: "5. Setup Dedicated Namespace",
    desc: "Enterprise partners receive a dedicated, logically isolated MariaDB namespace for complete compliance and security.",
  },
  {
    title: "6. Catalogue Ingestion",
    desc: "Deliver your custom FLAC or MP3 files via our secure SFTP pipeline or S3 compatible hot-storage endpoints.",
  },
  {
    title: "7. FAISS Index Building",
    desc: "Our automated pipeline converts your tracks into high-dimensional audio embeddings and indexes them using FAISS.",
  },
  {
    title: "8. Go Live!",
    desc: "Deploy production sound similarity searches to your customers with sub-50ms latency guarantees.",
  },
];

export default function PartnersPage() {
  const {
    formData,
    isSubmitting,
    isSuccess,
    errorMessage,
    copySuccess,
    setIsSuccess,
    handleInputChange,
    handleFormSubmit,
    handleCopyCredentials,
  } = usePartners();

  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  const sandboxKey = "rmx_sandbox_demo_1234567890";
  const sandboxCurl = `curl -X POST "https://api.resomix.com/v1/similarity/search" \\
  -H "Authorization: Bearer ${sandboxKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"track_uuid": "f4c44d99-5100-4437-a8b1-f6a0db46c789", "limit": 5}'`;

  return (
    <div className="bg-black text-white min-h-screen py-16 px-4 md:px-8 select-none font-sans overflow-hidden relative">
      {/* Dynamic sound wave background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
        <div className="w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,var(--color-neon-orange)_0%,transparent_70%)] blur-3xl transform -translate-y-1/4"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-16">
        
        {/* HERO SECTION */}
        <div className="text-center md:text-left space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-800 pb-8">
            <div>
              <span className="text-5xl md:text-7xl font-bold tracking-widest font-benzin uppercase block text-[var(--color-neon-orange)]">
                B2B PARTNERS
              </span>
              <span className="text-lg md:text-2xl font-light text-zinc-400 mt-2 block uppercase tracking-wider">
                Unbounded sound similarity, isolated namespaces, premium delivery.
              </span>
            </div>
            <div className="flex items-center gap-4">
              <img src={SoundWaves} className="w-16 h-12 animate-pulse" alt="Sound Waves" />
              <span className="font-benzin text-zinc-500 uppercase tracking-widest text-sm hidden md:inline">
                Sonic Pipeline
              </span>
            </div>
          </div>
        </div>

        {/* CORE VALUE PROPOSITIONS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800/80 p-8 rounded-lg relative hover:border-zinc-700 transition-all group">
            <div className="absolute top-4 right-4 text-xs font-benzin text-zinc-700 group-hover:text-[var(--color-neon-orange)] transition-colors">01</div>
            <h3 className="text-xl font-bold font-benzin uppercase tracking-wider mb-3">Logical Isolation</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              We guarantee absolute data sovereignty with fully isolated, single-tenant MySQL/FAISS databases matching enterprise policies.
            </p>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800/80 p-8 rounded-lg relative hover:border-zinc-700 transition-all group">
            <div className="absolute top-4 right-4 text-xs font-benzin text-zinc-700 group-hover:text-[var(--color-neon-orange)] transition-colors">02</div>
            <h3 className="text-xl font-bold font-benzin uppercase tracking-wider mb-3">Ultra-Low Latency</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Our FAISS indices run preloaded in memory to return hyper-accurate sound match vectors in under 50 milliseconds globally.
            </p>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800/80 p-8 rounded-lg relative hover:border-zinc-700 transition-all group">
            <div className="absolute top-4 right-4 text-xs font-benzin text-zinc-700 group-hover:text-[var(--color-neon-orange)] transition-colors">03</div>
            <h3 className="text-xl font-bold font-benzin uppercase tracking-wider mb-3">Acoustic Search</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Deliver recommendations purely based on auditory attributes and emotional signatures, rather than crowdsourced tag metadata.
            </p>
          </div>
        </div>

        {/* INTERACTIVE VIDEO DEMO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-zinc-900/30 border border-zinc-800/50 p-8 rounded-xl backdrop-blur-sm">
          <div className="space-y-6">
            <span className="text-xs uppercase tracking-widest font-benzin text-[var(--color-neon-orange)]">Interactive Demo</span>
            <h2 className="text-3xl font-bold font-benzin uppercase leading-tight">60-Second Video Walkthrough</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Explore how Resomix transforms standard audio catalogue archives into indexed vectors. Watch our platform in action, demonstrating live ingestion pipelines, real-time embedding generation, and sub-50ms acoustic similarity lookups.
            </p>
            <div className="flex items-center gap-4 text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-[var(--color-neon-orange)] animate-ping"></span>
              <span className="text-xs font-mono">Press play to begin preview</span>
            </div>
          </div>

          <div className="relative group rounded-lg overflow-hidden border border-zinc-800 bg-black aspect-video flex items-center justify-center cursor-pointer shadow-2xl">
            {/* Elegant glassmorphic play button overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 transition-opacity group-hover:opacity-90"></div>
            
            {/* Visual audio visualizer effect behind play button */}
            <div className="absolute w-24 h-24 rounded-full bg-[var(--color-neon-orange)]/10 scale-95 group-hover:scale-110 transition-transform duration-500 blur-md"></div>
            
            <div className="relative z-20 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-xl">
                <svg className="w-6 h-6 fill-current translate-x-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="text-xs font-benzin uppercase tracking-widest text-zinc-300">Play B2B Pipeline Walkthrough</span>
            </div>

            {/* Video Placeholder Styling */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
              <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">01:00</span>
              <span className="text-[10px] font-mono bg-[var(--color-neon-orange)] text-white px-2 py-0.5 rounded uppercase tracking-wider">HD</span>
            </div>
          </div>
        </div>

        {/* ONBOARDING MILESTONES CAROUSEL */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-8 backdrop-blur-sm space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-benzin text-[var(--color-neon-orange)]">Partnership Flow</span>
              <h2 className="text-3xl font-bold font-benzin uppercase mt-1">8-Slide Onboarding Journey</h2>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveCarouselIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeCarouselIndex === 0}
                className="p-2 border border-zinc-800 rounded bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900/80 transition-all text-sm"
              >
                ← Prev
              </button>
              <span className="text-sm font-mono px-3 text-zinc-400">
                {activeCarouselIndex + 1} / 8
              </span>
              <button 
                onClick={() => setActiveCarouselIndex((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1))}
                disabled={activeCarouselIndex === ONBOARDING_STEPS.length - 1}
                className="p-2 border border-zinc-800 rounded bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900/80 transition-all text-sm"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="relative min-h-[160px] bg-black/60 border border-zinc-800/50 rounded-lg p-6 flex flex-col justify-center">
            <div className="space-y-3">
              <h4 className="text-lg md:text-xl font-bold uppercase tracking-wider font-benzin text-[var(--color-neon-orange)]">
                {ONBOARDING_STEPS[activeCarouselIndex].title}
              </h4>
              <p className="text-zinc-300 text-sm md:text-base leading-relaxed max-w-4xl">
                {ONBOARDING_STEPS[activeCarouselIndex].desc}
              </p>
            </div>
          </div>

          {/* Carousel dots indicator */}
          <div className="flex justify-center gap-2">
            {ONBOARDING_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveCarouselIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeCarouselIndex === idx ? "w-8 bg-[var(--color-neon-orange)]" : "w-2 bg-zinc-800 hover:bg-zinc-700"
                }`}
              ></button>
            ))}
          </div>
        </div>

        {/* TRY SANDBOX CTA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border border-zinc-800 rounded-xl bg-gradient-to-br from-zinc-900/40 via-zinc-950 to-zinc-900/40 p-8 backdrop-blur-sm relative overflow-hidden">
          <div className="space-y-6 self-center">
            <span className="text-xs uppercase tracking-widest font-benzin text-[var(--color-neon-orange)]">Developer Sandbox</span>
            <h2 className="text-3xl font-bold font-benzin uppercase leading-tight">Try the Sandbox Catalog</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Skip waitlists and begin querying instantly using our public Sandbox API Key. Access the seeded partner tenant loaded with 700+ CC BY 4.0 acoustically distinct tracks.
            </p>
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider text-zinc-500 font-benzin block">Credentials</span>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="bg-zinc-950 px-4 py-3 rounded border border-zinc-800 font-mono text-xs flex-1 flex items-center justify-between overflow-x-auto text-[var(--color-neon-orange)]">
                  <code>{sandboxKey}</code>
                </div>
                <button
                  onClick={() => handleCopyCredentials(sandboxKey)}
                  className="bg-white hover:bg-zinc-200 text-black font-benzin uppercase text-xs px-5 py-3 rounded transition-all tracking-wider font-semibold whitespace-nowrap"
                >
                  {copySuccess ? "Copied!" : "Copy Key"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 font-mono text-[11px] md:text-xs text-zinc-400 space-y-3 relative select-text overflow-x-auto">
            <div className="absolute top-3 right-3 text-[10px] font-sans font-semibold uppercase text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              Interactive curl
            </div>
            <span className="text-zinc-600 font-sans font-semibold text-[10px] uppercase block mb-1">Similarity Lookup</span>
            <pre className="text-emerald-400 leading-relaxed">
              {sandboxCurl}
            </pre>
            <button
              onClick={() => handleCopyCredentials(sandboxCurl)}
              className="mt-2 text-[10px] font-sans font-semibold text-zinc-500 hover:text-white uppercase transition-colors"
            >
              Copy CURL Command
            </button>
          </div>
        </div>

        {/* DEVELOPER PRODUCTION REGISTRATION FORM */}
        <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-8 backdrop-blur-md space-y-8" id="developer-form">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase tracking-widest font-benzin text-[var(--color-neon-orange)]">Get Production Access</span>
            <h2 className="text-3xl font-bold font-benzin uppercase">Developer Portal Form</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Ready to deploy Resomix search queries on your main commercial catalogs? Submit your estimated volumes below to generate an authorization request routed to our partner team.
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-xl font-bold">✓</div>
              <h4 className="text-xl font-bold font-benzin uppercase">Request Dispatching</h4>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Your B2B Partner API request was successfully generated! If your native email client did not launch, please send your details to <a href="mailto:partners@resomix.com" className="text-[var(--color-neon-orange)] hover:underline">partners@resomix.com</a>.
              </p>
              <button
                onClick={() => setIsSuccess(false)}
                className="border border-zinc-800 hover:bg-zinc-900 text-white font-benzin uppercase text-xs px-6 py-2.5 rounded transition-all tracking-wider"
              >
                Submit Another Request
              </button>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 select-text">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-benzin">Company / Legal Name *</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  placeholder="e.g. Acme Audio B.V."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder-zinc-700 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-benzin">Contact Name *</label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleInputChange}
                  placeholder="e.g. Alex Carter"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder-zinc-700 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-benzin">Contact Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleInputChange}
                  placeholder="e.g. alex@acme.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder-zinc-700 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-benzin">Preferred Tier</label>
                <select
                  name="estimatedCalls"
                  value={formData.estimatedCalls}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors"
                >
                  <option value="">Select a tier...</option>
                  <option value="Starter Tier (€99/mo)">Starter (€99/mo)</option>
                  <option value="Growth Tier (€499/mo)">Growth (€499/mo)</option>
                  <option value="Enterprise Tier (Contact)">Enterprise (Silo Namespace)</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-benzin">Acoustic Catalog Size / Use Case</label>
                <textarea
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Describe your catalogue scale, required query volumes, and why sound similarity is core to your platform..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder-zinc-700 transition-colors resize-none"
                />
              </div>

              {errorMessage && (
                <div className="md:col-span-2 text-xs font-semibold text-red-500 uppercase tracking-wider">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="md:col-span-2 flex justify-center pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[var(--color-neon-orange)] hover:bg-red-600 text-white font-benzin uppercase tracking-widest text-xs px-8 py-4 rounded transition-all font-bold disabled:opacity-50"
                >
                  {isSubmitting ? "Generating Request..." : "Request Production Key"}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
