import { useState } from "react";
import { PAGE_MARK_STATIC, PAGE_TEXT_LINK } from "../Content/pageChrome";

interface AuthStatusBannerProps {
  onResendVerification: () => void;
  onDismiss: () => void;
}

export const AuthStatusBanner: React.FC<AuthStatusBannerProps> = ({
  onResendVerification,
  onDismiss,
}) => {
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await onResendVerification();
    } finally {
      setResending(false);
    }
  };

  return (
    // A notice, not a control: it reports something and offers actions, but the block itself isn't
    // operable — so it wears the hairline mark, not the full-weight one. (It previously used an
    // accent rule down the left edge; that treatment now means playback/selection state.)
    // `relative z-40`: this sits in the same slot as DemoStageBanner and had the same problem —
    // covered by the page shell's fixed backdrop. Worse, its z-10 was inert, because z-index does
    // nothing on a statically positioned box.
    <div className={`relative z-40 mb-[var(--px-20)] flex w-full items-center justify-between gap-[var(--px-12)] border border-[var(--rx-color-border-subtle)] bg-[var(--rx-color-surface)] p-[var(--px-12)] ${PAGE_MARK_STATIC}`}>
      <div className="flex flex-1 items-center gap-[var(--px-10)]">
        <svg
          viewBox="0 0 24 24"
          className="h-[var(--px-16)] w-[var(--px-16)] shrink-0 text-[var(--rx-color-accent)]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3L1.5 21h21L12 3z" />
          <path d="M12 10v4" />
          <path d="M12 17.5h.01" />
        </svg>
        <p className="m-0 font-helvetica text-[length:var(--px-12)] font-light text-[var(--rx-color-text-secondary)]">
          <span className="font-medium text-[var(--rx-color-text-primary)]">
            Please verify your email
          </span>{" "}
          to access all features.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-[var(--px-10)]">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className={`${PAGE_TEXT_LINK} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {resending ? "Sending..." : "Resend Email"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-[var(--px-24)] w-[var(--px-24)] cursor-pointer items-center justify-center border border-[var(--rx-color-border-default)] text-[var(--rx-color-text-muted)] transition-colors hover:border-[var(--rx-color-border-strong)] hover:text-[var(--rx-color-text-primary)]"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" className="h-[var(--px-11)] w-[var(--px-11)]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

