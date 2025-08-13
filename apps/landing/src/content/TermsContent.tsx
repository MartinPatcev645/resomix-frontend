import { Link } from "react-router-dom";

export default function TermsContent() {
  return (
    <section className="py-[var(--px-120)] px-[var(--px-20)] md:px-0">
      <div className="max-w-[var(--px-1023)] mx-auto">
        <div className="mb-[var(--px-24)]">
          <Link to="/" className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors">← Back to Home</Link>
        </div>

        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-48)] leading-tight font-bold tracking-tight">TERMS OF SERVICE</h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] opacity-80">Please read these terms carefully before using our audio intelligence platform.</p>
          <p className="mt-[var(--px-8)] text-[length:var(--px-12)] opacity-60">Last updated: June 15, 2024</p>
        </header>

        <div className="space-y-[var(--px-20)] text-[length:var(--px-14)] leading-relaxed">
          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">1. Acceptance of Terms</h2>
            <p>By accessing or using the Resomix service, you affirm that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these Terms, you may not access or use the service.</p>
          </section>

          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">2. Description of Service</h2>
            <p>Resomix is a music analysis and recommendation service designed to help users find similar tracks based on musical characteristics. The service analyzes uploaded audio files to provide music recommendations.</p>
          </section>

          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">3. User Accounts</h2>
            <p>You may be required to create an account to use certain features of the service. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
          </section>

          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">4. Content and Licensing</h2>
            <p>By uploading audio files to our service, you grant Resomix a non-exclusive, worldwide, royalty-free license to use, process, and analyze the audio files for the purpose of providing recommendations and improving our service.</p>
            <p className="mt-[var(--px-10)]">You represent and warrant that you own or have the necessary rights, licenses, and permissions to upload the content to our service, and that the content does not infringe on the intellectual property rights of any third party.</p>
          </section>

          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">5. Prohibited Uses</h2>
            <ul className="list-disc pl-6 space-y-[var(--px-6)]">
              <li>Uploading content that infringes on the intellectual property rights of others</li>
              <li>Uploading content that is illegal, harmful, threatening, or otherwise objectionable</li>
              <li>Attempting to gain unauthorized access to the service or its related systems</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">6. Termination</h2>
            <p>We may suspend or terminate your access to the service at any time if we reasonably believe that you have violated these Terms or engaged in fraudulent or unlawful activities.</p>
          </section>

          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Resomix will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.</p>
          </section>

          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">8. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will post the updated Terms on this page and update the “Last updated” date. Your continued use of the service after any changes indicates your acceptance of the new Terms.</p>
          </section>

          <section>
            <h2 className="text-[length:var(--px-18)] font-semibold mb-[var(--px-10)]">9. Contact</h2>
            <p>If you have questions about these Terms, please contact us at support@resomix.com.</p>
          </section>
        </div>
      </div>
    </section>
  );
} 