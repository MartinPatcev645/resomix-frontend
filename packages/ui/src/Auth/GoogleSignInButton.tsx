import { useEffect, useRef, useState } from 'react';
import { loadGoogleGsi, handleGoogleCredential } from './googleGsi';

interface GoogleSignInButtonProps {
  /** Google OAuth Web Client ID. Falls back to VITE_GOOGLE_CLIENT_ID if omitted. */
  clientId?: string;
  /**
   * "Link" mode: when provided, the raw Google ID token is handed back and the normal SIGN-IN is
   * skipped entirely (no login, no session change). Used by "Connect Google" in the profile, which
   * links the Google identity to the already-authenticated user. `onSuccess`/`onError` are ignored.
   */
  onCredential?: (credential: string) => void;
  /** Called after a successful sign-in (auth store is already populated). Ignored in link mode. */
  onSuccess?: (data: any) => void;
  onError?: (message: string) => void;
  /** Visible label. */
  label?: string;
  /** Pixel width of the pill (and the invisible GIS button behind it). Google enforces 200–400. */
  width?: number;
  /** Overrides the wrapper's default `mx-auto` — pass "" (or "mx-0") to place it inline in a flex row. */
  className?: string;
}

// Width shared by the visible pill and the invisible GIS button behind it (they must match so the
// real Google button reliably catches the click). Google caps rendered-button width at 400.
const BUTTON_WIDTH = 320;

/** Official multi-colour Google "G". */
function GoogleGIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/**
 * Minimal, on-theme "Continue with Google" pill. The visible pill is our own styling; Google's real
 * button is rendered on top at 0 opacity to catch the click and return the ID token (the supported
 * way to get a fully custom look while staying compliant). Renders nothing if Google isn't configured.
 */
export function GoogleSignInButton({
  clientId,
  onCredential,
  onSuccess,
  onError,
  label = 'Continue with Google',
  width = BUTTON_WIDTH,
  className,
}: GoogleSignInButtonProps) {
  const gsiRef = useRef<HTMLDivElement | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const resolvedClientId = clientId || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let cancelled = false;
    if (!resolvedClientId) {
      setUnavailable(true);
      return;
    }
    loadGoogleGsi()
      .then(() => {
        if (cancelled || !gsiRef.current) return;
        const google = (window as any).google;
        if (!google?.accounts?.id) {
          setUnavailable(true);
          return;
        }
        google.accounts.id.initialize({
          client_id: resolvedClientId,
          callback: async (response: { credential: string }) => {
            // Link mode: hand the raw token to the caller and DON'T sign in (no session change).
            if (onCredential) {
              onCredential(response.credential);
              return;
            }
            const res = await handleGoogleCredential(response.credential);
            if (res.success) onSuccess?.(res.data);
            else onError?.(res.error);
          },
          use_fedcm_for_prompt: true,
        });
        gsiRef.current.innerHTML = '';
        google.accounts.id.renderButton(gsiRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: width,
        });
      })
      .catch(() => setUnavailable(true));
    return () => {
      cancelled = true;
    };
  }, [resolvedClientId]);

  if (unavailable) return null;

  return (
    <div className={`relative group ${className ?? 'mx-auto'}`} style={{ width }}>
      {/* Visible pill (what the user sees). pointer-events-none so the click reaches the real button. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-[var(--px-10)] rounded-full border border-dotted border-slate-300/60 bg-transparent text-[length:var(--px-12)] font-light font-helvetica tracking-[var(--px-0-25)] text-[var(--color-primary)] transition-colors duration-150 group-hover:border-slate-200 group-hover:bg-white/5"
      >
        <GoogleGIcon />
        <span>{label}</span>
      </div>
      {/* Real Google button on top, invisible — catches the click and returns the ID token. */}
      <div ref={gsiRef} className="opacity-0" />
    </div>
  );
}

export default GoogleSignInButton;
