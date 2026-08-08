import React from "react";
import { useAuthStore } from "@resomix/stores";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";

/**
 * Explains a session the SERVER ended, in the two ways that can happen.
 *
 * **Expired** — a refresh 401/403 in the axios interceptor, or `verifySession` returning invalid
 * at boot. Logging in again fixes it, so that is what the CTA offers.
 *
 * **Deactivated** — the account was suspended by an admin or deleted by the user (possibly in
 * another tab). Logging in again *cannot* work: the server refuses at the login endpoint too.
 * Showing the expiry copy here sends someone round a loop that has no exit, which is why this is a
 * separate state rather than a variation in wording.
 *
 * By the time either renders, the store has already logged the user out everywhere — the logout
 * broadcast carries the reason, so every open tab raises the matching message. This only explains
 * why.
 *
 * Mounted ONCE in App.tsx so it covers every route, desktop and mobile alike (GateCtaModal is
 * fully responsive). Never fires on a user-initiated logout (reason "user" sets neither flag).
 */
export const SessionExpiredModal: React.FC = () => {
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const accountDeactivated = useAuthStore((s) => s.accountDeactivated);
  const setSessionExpired = useAuthStore((s) => s.setSessionExpired);
  const setAccountDeactivated = useAuthStore((s) => s.setAccountDeactivated);

  // Deactivation wins if both are somehow set: it is the more specific and more final of the two.
  if (accountDeactivated) {
    return (
      <GateCtaModal
        reason="login_required"
        title="Account deactivated"
        body={
          "This account has been deactivated, so you've been signed out. If you asked us to " +
          "delete it, nothing is gone yet — your data is kept for 30 days. Contact support " +
          "before then and we can restore everything exactly as you left it."
        }
        onClose={() => setAccountDeactivated(false)}
      />
    );
  }

  return (
    <GateCtaModal
      reason={sessionExpired ? "login_required" : null}
      title="Session expired"
      body="Your session has expired. Please log in again to continue where you left off."
      onClose={() => setSessionExpired(false)}
    />
  );
};

export default SessionExpiredModal;
