import { useContactSubmit } from "@resomix/hooks";
import { StatusMessage } from "../Elements/StatusMessage";
import { useState, useEffect } from "react";
import { useAuthStore } from "@resomix/stores";

import {
  PAGE_BTN_PRIMARY as BTN_PRIMARY,
  PAGE_BTN_SECONDARY as BTN_SECONDARY,
  PAGE_FIELD as FIELD,
  PAGE_FIELD_LABEL as FIELD_LABEL,
  PAGE_KICKER as KICKER,
  PAGE_PANEL as PANEL,
  PAGE_SUBLABEL as SUBLABEL,
} from "./pageChrome";

/**
 * Contact page in the precision-industrial theme, matching Profile / Library / 404 and the
 * modals: accent rule + mono kicker, large uppercase heading, bordered panels on a solid surface.
 *
 * The form borrows its LAYOUT from the /partners contact form (two-column grid, wide fields
 * spanning both columns, a head strip labelling the form, a rule above the submit row) but uses
 * the shared pageChrome field styling rather than partners.css, because that stylesheet is scoped
 * to `.pn-page` in the landing app and this component also renders in the webapp.
 *
 * Behaviour is unchanged: useContactSubmit still owns state, validation and submission, and
 * failures still surface through the same StatusMessage. The asterisks below are labelling of the
 * hook's EXISTING required-field rules (name, email, message), not new validation.
 */

/** Textarea variant of the shared field: taller, padded vertically, user-resizable. */
const FIELD_TEXTAREA = `${FIELD} !min-h-[var(--px-120)] py-[var(--px-10)] resize-y leading-[var(--px-20)]`;

/** Mail link inside the channel panels. */
const MAIL_LINK =
  "font-helvetica text-[length:var(--px-12)] font-light text-[var(--rx-color-accent)] underline-offset-2 " +
  "transition-colors duration-[var(--rx-duration-base)] hover:text-[var(--rx-color-accent-hover)] hover:underline";

interface ContactContentProps {
  baseUrl?: string;
}

/** One support channel — rendered as a panel in the aside. */
function ChannelPanel({
  kicker,
  blurb,
  email,
  hours,
}: {
  kicker: string;
  blurb: string;
  email: string;
  hours: string;
}) {
  return (
    <div className={PANEL}>
      <p className={KICKER}>{kicker}</p>
      <p className="mt-[var(--px-10)] font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-18)] text-[var(--rx-color-text-secondary)] opacity-70">
        {blurb}
      </p>
      <a href={`mailto:${email}`} aria-label={`Email ${email}`} className={`${MAIL_LINK} mt-[var(--px-12)] block`}>
        {email}
      </a>
      <p className={`${SUBLABEL} mt-[var(--px-12)]`}>{hours}</p>
    </div>
  );
}

export default function ContactContent({ baseUrl = "https://resomix.com" }: ContactContentProps) {
  const { user, isAuthenticated } = useAuthStore();
  const { form, handleChange, handleSubmit, submitting, setFormValues } = useContactSubmit();

  // Pre-fill form with user data if logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormValues({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [isAuthenticated, user, setFormValues]);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<'loading' | 'success' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState('');

  const submitHandler = async () => {
    setStatusType('loading');
    setShowStatus(true);
    const result = await handleSubmit();
    if (result.success) {
      setStatusType('success');
      setStatusMessage('Message sent successfully!');
    } else {
      setStatusType('error');
      setStatusMessage(result.message || 'An error occurred');
    }
  };

  return (
    // Spacing matches the workspace shell and the Profile page: a small inset from the vertical
    // side lines, and no oversized top pad — the layout's <main> already offsets the header.
    <section className="px-[var(--px-12)] pt-[var(--px-16)] pb-[var(--px-40)] tracking-[var(--px-1)]">
      <div className="mx-auto w-full max-w-6xl text-[var(--rx-color-text-primary)]">
        {/* Header — accent rule + mono kicker, then a left-aligned heading, as on Profile. */}
        <header className="mb-[var(--px-24)]">
          <p className="mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] before:block before:w-[var(--px-32)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
            Contact // Support
          </p>
          <h1 className="m-0 font-helvetica text-[length:var(--px-28)] font-medium uppercase leading-[var(--px-32)] md:text-[length:var(--px-36)] md:leading-[var(--px-40)]">
            Contact Us
          </h1>
          <p className="mt-[var(--px-12)] font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)] opacity-70">
            A question about the service, technical support, or feedback — our team is here to help.
          </p>
        </header>

        {/* Same control and label treatment as the Library and Profile back buttons. */}
        <div className="mb-[var(--px-24)]">
          <a href={baseUrl} aria-label="Home" className={`${BTN_SECONDARY} gap-[var(--px-6)]`}>
            <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Home
          </a>
        </div>

        {/* Form gets the wide column; channels sit alongside on desktop. DOM order puts the form
            first so mobile leads with the thing people came to do. */}
        <div className="grid grid-cols-1 items-start gap-[var(--px-24)] lg:grid-cols-[1fr_clamp(260px,24vw,340px)]">
          <div className="relative border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] before:absolute before:left-[var(--px-24)] before:top-0 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
            {/* Head strip labelling the form, as on the partners form. */}
            <div className="flex flex-wrap items-center justify-between gap-[var(--px-12)] border-b border-[var(--rx-color-border-subtle)] bg-[rgba(255,255,255,0.02)] px-[var(--px-20)] py-[var(--px-14)]">
              <p className={KICKER}>Send a message</p>
              <span className={SUBLABEL}>
                <span className="text-[var(--rx-color-accent)]">*</span> Required
              </span>
            </div>

            <div className="grid grid-cols-1 gap-x-[var(--px-20)] gap-y-[var(--px-16)] p-[var(--px-20)] md:grid-cols-2">
              <div className="flex flex-col gap-[var(--px-7)]">
                <label htmlFor="contact-name" className={FIELD_LABEL}>
                  Your Name <span className="text-[var(--rx-color-accent)]" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  className={FIELD}
                />
              </div>

              <div className="flex flex-col gap-[var(--px-7)]">
                <label htmlFor="contact-email" className={FIELD_LABEL}>
                  Email Address <span className="text-[var(--rx-color-accent)]" aria-hidden="true">*</span>
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  className={FIELD}
                />
              </div>

              <div className="flex flex-col gap-[var(--px-7)]">
                <label htmlFor="contact-subject" className={FIELD_LABEL}>
                  Subject <span className="opacity-70">(optional)</span>
                </label>
                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="Brief description of your inquiry"
                  className={FIELD}
                />
              </div>

              <div className="flex flex-col gap-[var(--px-7)]">
                <label htmlFor="contact-phone" className={FIELD_LABEL}>
                  Phone Number <span className="opacity-70">(optional)</span>
                </label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Your phone number"
                  className={FIELD}
                />
              </div>

              <div className="flex flex-col gap-[var(--px-7)] md:col-span-2">
                <label htmlFor="contact-message" className={FIELD_LABEL}>
                  Message <span className="text-[var(--rx-color-accent)]" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Please describe your question or concern in detail..."
                  className={FIELD_TEXTAREA}
                />
              </div>

              <div className="flex flex-wrap items-center gap-[var(--px-16)] border-t border-dotted border-[var(--rx-color-border-subtle)] pt-[var(--px-20)] md:col-span-2">
                <button
                  type="button"
                  onClick={submitHandler}
                  disabled={submitting}
                  // `!` because PAGE_BTN_BASE already sets min-h/px — two arbitrary values of the
                  // same utility resolve by stylesheet order, not by order in this string.
                  className={`${BTN_PRIMARY} !min-h-[var(--px-44)] !px-[var(--px-22)]`}
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-[var(--px-16)] lg:sticky lg:top-[var(--px-120)] h-max">
            <ChannelPanel
              kicker="Customer Support"
              blurb="Need help with Resomix? Contact our support team."
              email="support@resomix.com"
              hours="Mon–Fri, 9AM–6PM EST"
            />
            <ChannelPanel
              kicker="Business Inquiries"
              blurb="For partnerships, press, or business inquiries."
              email="support@resomix.com"
              hours="Mon–Fri, 9AM–6PM EST"
            />
          </aside>
        </div>

        <StatusMessage isOpen={showStatus} onClose={() => setShowStatus(false)} status={statusType} message={statusMessage} />
      </div>
    </section>
  );
}
