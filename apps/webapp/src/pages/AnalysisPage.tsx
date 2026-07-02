

export default function AnalysisPage() {
  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Analysis
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Track analysis results and audio insights
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-[var(--px-20)] lg:px-0">
          <div className="p-[var(--px-40)] border border-slate-200 border-dotted rounded-lg text-center">
            <p className="text-[length:var(--px-14)] font-light font-helvetica opacity-60">
              No analysis data yet. Upload a track to see detailed audio analysis and similarity metrics.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
