import React from "react";
import { ButtonSleek } from "@resomix/ui";
import { useEntitlementCta } from "@/utils/entitlementCta.ts";

/**
 * GateCtaModal — the soft entitlement-gate prompt (Phase 8.2).
 *
 * Shown when a create is blocked by a plan limit (the server returned a `reason`):
 *   - `login_required` (guest hit the daily free limit / guest-only action) → log in / sign up;
 *   - `upgrade_required` (logged-in user hit their plan cap) → subscribe.
 *
 * Soft by design — it nudges, never hard-blocks. Routing goes through `useEntitlementCta`, so the
 * "Subscribe" action lights up automatically when billing ships (see `SUBSCRIPTION_ENABLED`).
 */
export interface GateCtaModalProps {
  reason: string | null; // "login_required" | "upgrade_required"
  onClose: () => void;
  /** Optional copy overrides — e.g. for the "log in to rate tracks" prompt. */
  title?: string;
  body?: string;
}

export const GateCtaModal: React.FC<GateCtaModalProps> = ({ reason, onClose, title: titleProp, body: bodyProp }) => {
  const { onLogin, onSubscribe } = useEntitlementCta();
  if (!reason) return null;

  const isLogin = reason === "login_required";
  const title = titleProp ?? (isLogin ? "Monthly free limit reached" : "Plan limit reached");
  const body = bodyProp ?? (isLogin
    ? "You've used this month's free playlists. Log in or create a free account to make more."
    : "You've reached your plan's monthly playlist limit. Subscribe to create more.");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-[var(--px-20)]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-40)] py-[var(--px-40)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center max-w-[var(--px-450)] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-[var(--px-12)] right-[var(--px-12)] w-[var(--px-24)] h-[var(--px-24)] flex items-center justify-center text-[var(--color-primary)] opacity-70 hover:opacity-100 transition-opacity cursor-pointer leading-none"
        >
          <svg viewBox="0 0 14 14" className="w-[var(--px-12)] h-[var(--px-12)]" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <h3 className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)] text-center">
          {title}
        </h3>
        <p className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] text-center text-white mb-[var(--px-20)]">
          {body}
        </p>
        <div className="flex gap-[var(--px-15)] justify-center items-center">
          {isLogin ? (
            <>
              <ButtonSleek text="Create Free Account" href="/auth/register" onClick={() => {}} />
              <ButtonSleek text="Log In" onClick={() => { onLogin(); onClose(); }} transparent />
            </>
          ) : (
            <ButtonSleek text="Subscribe" onClick={() => { onSubscribe(); onClose(); }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default GateCtaModal;
