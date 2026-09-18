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
 *
 * `surface` says where the sign-in was started ("register", "login", "one_tap"). It is only used to
 * label the analytics sign-up event, so callers that do not care can leave it alone.
 */
export async function handleGoogleCredential(
  credential: string,
  surface = 'google',
): Promise<GoogleCredentialResult> {
  try {
    const { loginWithGoogle } = await import('@resomix/api-client');
    const { useAuthStore } = await import('@resomix/stores');
    const result = await loginWithGoogle(credential);
    if (result.success && result.data && 'access_token' in result.data) {
      const data = result.data as { access_token: string; user: any; is_new_user?: boolean };
      // One Google button covers sign-up and sign-in, and only the server can tell them apart, so
      // this fires solely on `is_new_user`. It runs BEFORE setAuth so a Google sign-up emits
      // signup_completed and then user_identified, the same order the email flow produces (setAuth
      // is what makes useAnalyticsIdentity announce the identity). Its own try/catch because an
      // analytics failure must never cost the user their sign-in; an older backend that omits the
      // flag simply emits nothing, exactly as before.
      if (data.is_new_user) {
        try {
          const { pushSignupCompleted } = await import('@resomix/hooks');
          pushSignupCompleted({ userId: data.user?.uuid, signupSource: 'google', surface });
        } catch {
          /* analytics is best-effort */
        }
      }
      useAuthStore.getState().setAuth(data.user, data.access_token);
      return { success: true, data: result.data };
    }
    return { success: false, error: (result as any)?.error || 'Google sign-in failed' };
  } catch (e) {
    return { success: false, error: 'Google sign-in failed. Please try again.' };
  }
}
