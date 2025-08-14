import { ButtonSleek } from "../index";

interface ContactContentProps {
  baseUrl?: string;
}

export default function ContactContent({ baseUrl = "https://resomix.com" }: ContactContentProps) {
  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">

        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">Contact us</h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica  ">
            We'd love to hear from you! Our team is ready to answer your questions and provide support.
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)]">
          <div className="mb-[var(--px-24)]">
            <a href={baseUrl} className="text-[length:var(--px-11)] font-light font-helvetica  hover:text-[var(--color-primary-hover)] transition-colors">← Back to Home</a>
          </div>

          <p className="mt-[var(--px-8)] text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica  ">
            Whether you have a question about our service, need technical support, or want to give us feedback,
            our team is here to help.
          </p>

          <div className="flex flex-col w-full gap-[var(--px-10)]">
            <div className="flex flex-col md:flex-row items-center w-full my-[var(--px-20)]">
              <div className="flex-1/2 lg:mr-[var(--px-10)] my-[var(--px-10)] lg:my-0 px-[var(--px-10)] py-[var(--px-20)] border border-slate-200 border-dotted pointer-events-none z-1 w-full">
                <div className="flex flex-col gap-[var(--px-10)] items-start text-left w-full">
                  <div className="text-[length:var(--px-10)] font-medium font-helvetica  ">
                    Customer Support
                  </div>
                  <div className="text-[length:var(--px-10)] font-extralight font-helvetica  leading-[var(--px-17)] opacity-80">
                    Need help with Resomix? Contact our
                    support team:
                  </div>
                  <div className="text-[length:var(--px-10)] font-light font-helvetica  leading-[var(--px-17)]">
                    Email: <a href="mailto:support@resomix.com" className="text-[var(--color-primary-hover)] hover:text-[var(--color-primary)] cursor-pointer pointer-events-auto">support@resomix.com</a>
                  </div>
                  <div className="text-[length:var(--px-10)] font-extralight font-helvetica  leading-[var(--px-17)] opacity-80">
                    Hours: Monday-Friday, 9AM-6PM EST
                  </div>
                </div>
              </div>
              <div className="flex-1/2 lg:ml-[var(--px-10)] my-[-var(--px-10)] lg:my-0 px-[var(--px-10)] py-[var(--px-20)] border border-slate-200 border-dotted pointer-events-none z-1 w-full">
                <div className="flex flex-col gap-[var(--px-10)] items-start text-left w-full">
                  <div className="text-[length:var(--px-10)] font-medium font-helvetica  ">
                    Business Inquiries
                  </div>
                  <div className="text-[length:var(--px-10)] font-extralight font-helvetica  leading-[var(--px-17)] opacity-80">
                    For partnerships, press, or business
                    inquiries:
                  </div>
                  <div className="text-[length:var(--px-10)] font-light font-helvetica  leading-[var(--px-17)]">
                    Email: <a href="mailto:business@resomix.com" className="text-[var(--color-primary-hover)] hover:text-[var(--color-primary)] cursor-pointer pointer-events-auto">business@resomix.com</a>
                  </div>
                  <div className="text-[length:var(--px-10)] font-light font-helvetica  leading-[var(--px-17)]">
                    Phone: <a href="tel:+15551234567" className="text-[var(--color-primary-hover)] hover:text-[var(--color-primary)] cursor-pointer pointer-events-auto">+1 (555) 123-4567</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start gap-[var(--px-10)]">
              <div className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
                Your Name
              </div>
              <input type="text" className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica" />
            </div>
            <div className="flex flex-col items-start gap-[var(--px-10)]">
              <div className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
                Email Address
              </div>
              <input type="text" className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica" />
            </div>
            <div className="flex flex-col items-start gap-[var(--px-10)]">
              <div className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
                Subject <span className="text-[length:var(--px-10)] opacity-80 font-extralight font-helvetica">(optional)</span>
              </div>
              <input type="text" className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica" placeholder="Brief description of your inquiry" />
            </div>
            <div className="flex flex-col items-start gap-[var(--px-10)]">
              <div className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
                Phone Number <span className="text-[length:var(--px-10)] opacity-80 font-extralight font-helvetica">(optional)</span>
              </div>
              <input type="text" className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica" placeholder="Your phone number" />
            </div>
            <div className="flex flex-col items-start gap-[var(--px-10)]">
              <div className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
                Message
              </div>
              <textarea className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica" rows={4} placeholder="Please describe your question or concern in detail..." />
            </div>
            <div className="mt-[var(--px-20)]">
              <ButtonSleek text="Send Message" onClick={() => {}} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
