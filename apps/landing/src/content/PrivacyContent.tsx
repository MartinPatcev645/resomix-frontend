import { Link } from "react-router-dom";

export default function PrivacyContent() {
    return (
        <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0">
            <div className="w-full flex flex-col items-center text-[var(--color-primary)]">

                <header className="mb-[var(--px-28)] text-center">
                    <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica">PRIVACY POLICY</h1>
                    <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                        Your privacy matters to us. Learn how we handle your data with care.
                    </p>
                    <p className="mt-[var(--px-8)] text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                        Last updated: August 15, 2025
                    </p>
                </header>

                <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)]">
                    <div className="mb-[var(--px-24)]">
                        <Link to="/" className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica tracking-[var(--px-1)] hover:text-[var(--color-primary-hover)] transition-colors">← Back to Home</Link>
                    </div>

                    <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                        At Resomix, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our service.
                    </p>

                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">Information We Collect</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                            We collect the following types of information:
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Audio files that you upload to our service
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Feedback and survey responses you provide
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Usage data and analytics about how you interact with our service
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Technical information such as your IP address, browser type, and device information
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">How We Use Your Information</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                            We use your information to:
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Provide and improve our music recommendation services
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Analyze musical patterns and features in uploaded tracks
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Improve our recommendation algorithms
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Communicate with you about our services
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Monitor and analyze usage patterns and trends
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">Data Retention</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                            We retain your uploaded audio files and associated data for as long as necessary to provide our services. You can request deletion of your data at any time by contacting us.
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">Data Security</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                            We implement appropriate technical and organizational measures to protect your personal
                            information from unauthorized access, disclosure, alteration, and destruction.
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">Your Rights</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                            Depending on your location, you may have rights regarding your personal information, including:
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Access to your personal information
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Correction of inaccurate information
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Deletion of your personal information
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Object to or restrict processing of your information
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            Data portability
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">Changes to This Policy</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the
                            new Privacy Policy on this page and updating the "Last updated" date.
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">Contact Us</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                            If you have any questions about this Privacy Policy, please contact us at
                            <a href="mailto:privacy@resomix.com" className="text-[var(--color-primary-hover)] hover:text-[var(--color-primary-hover-hover)] transition-colors"> privacy@resomix.com</a>.
                        </p>
                    </section>
                </div>
            </div>
        </section>
    );
}
