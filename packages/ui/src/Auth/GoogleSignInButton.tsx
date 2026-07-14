import { useEffect, useRef, useState } from 'react';
import { loadGoogleGsi, handleGoogleCredential } from './googleGsi';

interface GoogleSignInButtonProps {
  /** Google OAuth Web Client ID. Falls back to VITE_GOOGLE_CLIENT_ID if omitted. */
  clientId?: string;
  /** Called after a successful sign-in (auth store is already populated). */
  onSuccess?: (data: any) => void;
  onError?: (message: string) => void;
  /** Button label variant. */
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

/**
 * Official Google "Sign in with Google" button (rendered by GIS). Renders nothing if Google isn't
 * configured or the script is blocked, so the password form is never left in a broken state.
 */
export function GoogleSignInButton({
  clientId,
  onSuccess,
  onError,
  text = 'continue_with',
}: GoogleSignInButtonProps) {
  const ref = useRef<HTMLDivElement | null>(null);
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
        if (cancelled || !ref.current) return;
        const google = (window as any).google;
        if (!google?.accounts?.id) {
          setUnavailable(true);
          return;
        }
        google.accounts.id.initialize({
          client_id: resolvedClientId,
          callback: async (response: { credential: string }) => {
            const res = await handleGoogleCredential(response.credential);
            if (res.success) onSuccess?.(res.data);
            else onError?.(res.error);
          },
          use_fedcm_for_prompt: true,
        });
        ref.current.innerHTML = '';
        google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'pill',
          logo_alignment: 'left',
          width: 320,
        });
      })
      .catch(() => setUnavailable(true));
    return () => {
      cancelled = true;
    };
  }, [resolvedClientId, text]);

  if (unavailable) return null;
  return <div ref={ref} className="flex justify-center" />;
}

export default GoogleSignInButton;
