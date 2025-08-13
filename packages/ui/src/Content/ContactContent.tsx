export default function ContactContent() {
  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">

        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">Contact us</h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
            We'd love to hear from you! Our team is ready to answer your questions and provide support.
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)]">
          <div className="mb-[var(--px-24)]">
            <a href="/" className="text-[length:var(--px-11)] font-light font-helvetica tracking-[var(--px-1)] hover:text-[var(--color-primary-hover)] transition-colors">← Back to Home</a>
          </div>

          <p className="mt-[var(--px-8)] text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
            Whether you have a question about our service, need technical support, or want to give us feedback,
            our team is here to help.
          </p>

          <div className="flex flex-col w-full gap-[var(--px-10)]">
            Okat
          </div>
        </div>
      </div>
    </section>
  );
}
