/**
 * Post-auth redirect persistence.
 *
 * The "return here after auth" target normally rides along in the URL (`?redirect=`) or router
 * state. That's enough for a same-session login, but it's lost when account creation goes through an
 * email-verification link (a fresh tab with no state/query) or any full reload mid-flow. Persisting
 * it in localStorage lets login / register-then-verify / Google all land back on the exact page
 * (e.g. a shared playlist's `?id=`).
 *
 * A short TTL keeps an abandoned attempt from silently redirecting a much-later, unrelated login.
 */
const KEY = 'resomix-post-auth-redirect';
const TTL_MS = 60 * 60 * 1000; // 1 hour

export const setPostAuthRedirect = (path: string): void => {
  try {
    // Bare home isn't worth persisting (it's the default fallback anyway).
    if (!path || path === '/') return;
    localStorage.setItem(KEY, JSON.stringify({ path, ts: Date.now() }));
  } catch {
    /* localStorage unavailable (private mode etc.) — non-fatal */
  }
};

export const getPostAuthRedirect = (): string | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { path, ts } = JSON.parse(raw);
    if (typeof path !== 'string' || typeof ts !== 'number' || Date.now() - ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return path;
  } catch {
    return null;
  }
};

export const clearPostAuthRedirect = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
};
