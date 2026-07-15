/**
 * Entitlement CTA routing (Phase 8.2)
 * ===================================
 *
 * One place that decides where the "unlock more" nudges go, so every entitlement gate in the UI
 * (dropdown depth, result teasing, export/rename/rate) routes consistently:
 *   - guests  → the login page (with a redirect back);
 *   - logged-in users → the subscription flow.
 *
 * Billing has shipped, so `subscribe` is live: `SUBSCRIPTION_ENABLED` is on and every "Subscribe"
 * CTA routes to the unified pricing page (`SUBSCRIBE_ROUTE`). Set the flag back to false to mute
 * all subscribe CTAs at once (e.g. if billing is temporarily pulled).
 */

import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export type EntitlementCtaAction = "login" | "subscribe" | null;

export const SUBSCRIPTION_ENABLED = true;
export const SUBSCRIBE_ROUTE = "/subscribe";

export function useEntitlementCta() {
  const navigate = useNavigate();
  const location = useLocation();

  const onLogin = useCallback(() => {
    navigate(`/auth/login?redirect=${encodeURIComponent(location.pathname)}`);
  }, [navigate, location.pathname]);

  const onSubscribe = useCallback(() => {
    if (SUBSCRIPTION_ENABLED) {
      navigate(SUBSCRIBE_ROUTE);
    }
    // Until billing ships the CTA is shown for messaging only; clicking is a no-op.
  }, [navigate]);

  const trigger = useCallback(
    (action: EntitlementCtaAction) => {
      if (action === "login") onLogin();
      else if (action === "subscribe") onSubscribe();
    },
    [onLogin, onSubscribe]
  );

  return { onLogin, onSubscribe, trigger, subscriptionEnabled: SUBSCRIPTION_ENABLED };
}
