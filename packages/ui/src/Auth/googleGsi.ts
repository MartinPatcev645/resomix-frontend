/**
 * Google Identity Services (GIS) helpers, shared by the "Continue with Google" button and One Tap.
 * We load Google's official script at runtime (no npm dependency) and exchange the returned ID token
 * for our own session, so everything downstream (refresh cookie, cross-subdomain sharing) is unchanged.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let loadPromise: Promise<void> | null = null;

/** Inject the GIS script once; resolves when `window.google.accounts.id` is ready. */
export function loadGoogleGsi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const done = () =>
      (window as any).google?.accounts?.id
        ? resolve()
        : reject(new Error('Google Identity Services loaded but unavailable'));

    const existing = document.getElementById('google-gsi-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => reject(new Error('Failed to load GIS')));
      if ((window as any).google?.accounts?.id) resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = done;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load GIS'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export type GoogleCredentialResult =
  | { success: true; data: any }
  | { success: false; error: string };

/**
 * Exchange a Google ID token for our session and populate the auth store — identical end state to a
 * password login. Imports are dynamic to avoid cross-package circular deps (same pattern as LoginContent).
 */
export async function handleGoogleCredential(credential: string): Promise<GoogleCredentialResult> {
  try {
    const { loginWithGoogle } = await import('@resomix/api-client');
    const { useAuthStore } = await import('@resomix/stores');
    const result = await loginWithGoogle(credential);
    if (result.success && result.data && 'access_token' in result.data) {
      const data = result.data as { access_token: string; user: any };
      useAuthStore.getState().setAuth(data.user, data.access_token);
      return { success: true, data: result.data };
    }
    return { success: false, error: (result as any)?.error || 'Google sign-in failed' };
  } catch (e) {
    return { success: false, error: 'Google sign-in failed. Please try again.' };
  }
}
