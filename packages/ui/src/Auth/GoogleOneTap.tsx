import { useEffect } from 'react';
import { loadGoogleGsi, handleGoogleCredential } from './googleGsi';

interface GoogleOneTapProps {
  /** Google OAuth Web Client ID. Falls back to VITE_GOOGLE_CLIENT_ID if omitted. */
  clientId?: string;
  /** Suppress the prompt (e.g. user already authenticated, or on the /auth page where the button shows). */
  disabled?: boolean;
  /** Optional callback after a successful One Tap sign-in (the auth store is already populated). */
  onSuccess?: (data: any) => void;
}

/**
 * Google One Tap — the small "Sign in with Google" prompt Google shows (top-right) to logged-out
 * visitors. Renders no DOM of its own; best-effort (never throws). Uses FedCM per current GIS.
 */
export function GoogleOneTap({ clientId, disabled, onSuccess }: GoogleOneTapProps) {
  const resolvedClientId = clientId || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (disabled || !resolvedClientId || typeof window === 'undefined') return;
    let cancelled = false;
    loadGoogleGsi()
      .then(() => {
        if (cancelled) return;
        const google = (window as any).google;
        if (!google?.accounts?.id) return;
        google.accounts.id.initialize({
          client_id: resolvedClientId,
          callback: async (response: { credential: string }) => {
            const res = await handleGoogleCredential(response.credential);
            // No full-page reload: handleGoogleCredential already populated the auth store, so the app
            // re-renders as logged-in and One Tap self-dismisses. A reload here would race the auth
            // persistence (leaving a half-logged-in state) and cancel in-flight requests.
            if (res.success) onSuccess?.(res.data);
          },
          use_fedcm_for_prompt: true,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        google.accounts.id.prompt();
      })
      .catch(() => {
        /* One Tap is best-effort — ignore load/prompt failures. */
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedClientId, disabled]);

  return null;
}

export default GoogleOneTap;
