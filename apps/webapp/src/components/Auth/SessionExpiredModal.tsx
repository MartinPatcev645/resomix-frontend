import React from "react";
import { useAuthStore } from "@resomix/stores";
import { GateCtaModal } from "@/components/Entitlements/GateCtaModal.tsx";

/**
 * SessionExpiredModal — shown when the SERVER invalidates the session (refresh 401/403 in the
 * axios interceptor, or `verifySession` returning invalid at boot). By then the store has already
 * logged the user out everywhere (cross-tab via the logout broadcast, which carries the reason so
 * every tab raises this modal); this just tells the user why and offers the login CTA.
 *
 * Mounted ONCE in App.tsx so it covers every route, desktop and mobile alike (GateCtaModal is
 * fully responsive). Never fires on a user-initiated logout (reason "user" doesn't set the flag).
 */
export const SessionExpiredModal: React.FC = () => {
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const setSessionExpired = useAuthStore((s) => s.setSessionExpired);

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
