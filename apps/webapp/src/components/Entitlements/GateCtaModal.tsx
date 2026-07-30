import React from "react";
import { Dialog, type DialogAction } from "@resomix/ui";
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
 *
 * Now a thin preset over the shared `Dialog`: this file keeps the reason→copy→CTA mapping, and the
 * shell supplies the portal, focus trap, scroll lock, Escape, backdrop and stacking. Its own
 * overlay used to be a hand-rolled `z-[100]`, which sat BELOW the mobile nav drawer (z-120), and it
 * handled neither Escape nor focus. Props and call sites are unchanged — all 10 of them.
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

  // Each CTA navigates away, so all of them close the gate on the way out (`dismiss`) — exactly
  // what the old inline `() => { onX(); onClose(); }` handlers did.
  const actions: DialogAction[] = isLogin
    ? [
        { label: "Log In", onClick: onLogin, tone: "secondary", dismiss: true },
        { label: "Create Free Account", onClick: onRegister, tone: "primary", dismiss: true, autoFocus: true },
      ]
    : [{ label: "Subscribe", onClick: onSubscribe, tone: "primary", dismiss: true, autoFocus: true }];

  return (
    <Dialog
      isOpen
      onClose={onClose}
      size="sm"
      // A gate sits over whatever the user was trying to do, including another dialog.
      elevation="top"
      eyebrow={isLogin ? "Access // Sign in" : "Plan // Upgrade"}
      title={title}
      subtitle={body}
      actions={actions}
      ariaLabel={title}
    />
  );
};

export default GateCtaModal;
