import React from "react";
import { ButtonSleek } from "@resomix/ui";
import { useEntitlementCta } from "@/utils/entitlementCta.ts";
import {
  WORKSPACE_BTN_PRIMARY,
  WORKSPACE_BTN_SECONDARY,
  WORKSPACE_FOCUS_VISIBLE,
} from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

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
  const { onLogin, onRegister, onSubscribe } = useEntitlementCta();
  if (!reason) return null;

  const isLogin = reason === "login_required";
  const title = titleProp ?? (isLogin ? "Monthly free limit reached" : "Plan limit reached");
  const body = bodyProp ?? (isLogin
    ? "You've used this month's free playlists. Log in or create a free account to make more."
    : "You've reached your plan's monthly playlist limit. Subscribe to create more.");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-[var(--px-20)]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[var(--px-450)] flex-col items-center border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] px-[var(--px-40)] py-[var(--px-40)] text-[var(--rx-color-text-primary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={`absolute right-[var(--px-12)] top-[var(--px-12)] flex h-[var(--px-24)] w-[var(--px-24)] items-center justify-center text-[var(--rx-color-text-secondary)] transition-opacity hover:text-[var(--rx-color-text-primary)] ${WORKSPACE_FOCUS_VISIBLE}`}
        >
          <svg viewBox="0 0 14 14" className="w-[var(--px-12)] h-[var(--px-12)]" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <h3 className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)] text-center">
          {title}
        </h3>
        <p className="mb-[var(--px-20)] mt-[var(--px-10)] text-center font-fira text-[length:var(--px-10)] font-light leading-[var(--px-13)] text-[var(--rx-color-text-secondary)]">
          {body}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-[var(--px-15)]">
          {isLogin ? (
            <>
              <ButtonSleek
                text="Create Free Account"
                onClick={() => { onRegister(); onClose(); }}
                className={WORKSPACE_BTN_PRIMARY}
              />
              <ButtonSleek
                text="Log In"
                onClick={() => { onLogin(); onClose(); }}
                transparent
                className={WORKSPACE_BTN_SECONDARY}
              />
            </>
          ) : (
            <ButtonSleek
              text="Subscribe"
              onClick={() => { onSubscribe(); onClose(); }}
              className={WORKSPACE_BTN_PRIMARY}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GateCtaModal;
