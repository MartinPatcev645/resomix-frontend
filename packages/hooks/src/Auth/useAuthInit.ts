import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@resomix/stores';
import { getMyProfile, refreshAccessToken, verifySession } from '@resomix/api-client';

// Global flag to ensure initialization only happens once across the entire app
// This persists across route navigations since App.tsx doesn't remount
let globalHasInitialized = false;

/** Decode the `sub` (user uuid) claim from a JWT access token, or null if unavailable/malformed. */
const tokenSubject = (token: string | null): string | null => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
};

/**
 * Guard against a stale cross-subdomain identity. Access tokens live in per-origin sessionStorage
 * and the persisted user in per-origin localStorage, but the refresh-token cookie is shared across
 * `*.resomix.com` — so a login on one subdomain can leave another subdomain holding a token that
 * belongs to a DIFFERENT user than the one it hydrated from its own storage. When the token's `sub`
 * (uuid) disagrees with the persisted user's uuid, the server session is the source of truth: fetch
 * the real profile and adopt it, dropping the previous identity's cached data (`setAuth` clears the
 * playlist/cart caches). It's a no-op — and issues NO request — when the token and persisted user
 * already agree, so the fast init path is untouched in the overwhelmingly common case.
 */
const reconcileIdentityIfMismatch = (): void => {
  const state = useAuthStore.getState();
  const sub = tokenSubject(state.accessToken);
  const persistedUuid = state.user?.uuid;
  if (!sub || !persistedUuid || sub === persistedUuid) return;
  getMyProfile()
    .then((res) => {
      if (!res.success) return;
      const actual: any = res.data && typeof res.data === 'object' && 'user' in res.data ? (res.data as any).user : res.data;
      const current = useAuthStore.getState();
      if (actual?.uuid && actual.uuid !== current.user?.uuid && current.accessToken) {
        useAuthStore.getState().setAuth(actual, current.accessToken);
      }
    })
    .catch(() => { /* non-blocking — the axios interceptor still guards each real request */ });
};

/**
 * Initialize authentication state on app load
 * Only checks for existing token/user - does NOT proactively refresh tokens
 * Token refresh is handled by authClient interceptor on 401 errors
 * This prevents unnecessary refresh calls and loaders on page navigation
 */

/**
 * Request a token from other open tabs via localStorage events.
 * Returns the token if received within the timeout, otherwise null.
 */
const requestTokenFromOtherTabs = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('storage', onStorage);
      resolve(null);
    }, 1000); // Wait up to 1 second for a response

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'resomix-token-update' && event.newValue) {
        try {
          const update = JSON.parse(event.newValue);
          if (update.token && typeof update.token === 'string') {
            clearTimeout(timeout);
            window.removeEventListener('storage', onStorage);
            resolve(update.token);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', onStorage);

    // Broadcast the request
    try {
      localStorage.setItem('resomix-token-request', String(Date.now()));
      // Delay cleanup to ensure browser dispatches the storage event to other tabs
      setTimeout(() => {
        try { localStorage.removeItem('resomix-token-request'); } catch { /* noop */ }
      }, 100);
    } catch (e) {
      console.warn('Failed to broadcast token request:', e);
      clearTimeout(timeout);
      window.removeEventListener('storage', onStorage);
      resolve(null);
    }
  });
};

export const useAuthInit = () => {
  const { setUser } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React StrictMode and across route changes
    if (hasInitialized.current || globalHasInitialized) {
      setIsInitialized(true);
      setIsLoading(false);
      return;
    }
    hasInitialized.current = true;
    globalHasInitialized = true;

    const initAuth = async () => {
      setIsLoading(true);
      const store = useAuthStore.getState();

      try {
        // Token is now restored from sessionStorage on store initialization
        // So it should be available immediately after page reload
        const token = store.accessToken;
        const hasUser = !!store.user;

        // If we have both token and user, initialize immediately (no API call needed)
        // Token was restored from sessionStorage, so we can use it right away
        if (token && hasUser) {
          // Token is available, but verify it's still valid by checking expiration
          // If expired, refresh in background (non-blocking)
          if (store.isTokenExpired()) {
            // console.log('[useAuthInit] Token expired, refreshing in background');
            refreshAccessToken().then((refreshResult) => {
              if (refreshResult.success && refreshResult.data?.access_token) {
                store.setAccessToken(refreshResult.data.access_token);
              } else {
                // Refresh failed → the session is genuinely over. End it here and raise the
                // "log in again" modal.
                //
                // This used to defer to the authClient interceptor on the next 401. That worked
                // only while EVERY endpoint 401'd on a dead token. Public reads no longer do:
                // a shared playlist now serves a guest view rather than refusing (see
                // `get_current_user_or_anonymous` on the backend), so the interceptor may never
                // fire — leaving the UI showing someone as logged in while the server treats
                // them as a guest. A Pro user then sees a 10-track redacted playlist with no
                // explanation and concludes the product is broken.
                //
                // `reason: 'expired'` is what distinguishes this from a user-initiated logout:
                // it clears the stale token and shows SessionExpiredModal.
                console.warn('[useAuthInit] Background token refresh failed — ending the session');
                // `broadcast: false` matches the verifySession path below: this is boot-time
                // discovery, and every other tab reaches the same conclusion on its own boot —
                // broadcasting would just make N tabs emit N logout events for one dead cookie.
                store.logout({ broadcast: false, reason: 'expired' });
                return;
              }
              // The (possibly refreshed) token may belong to a different user than the one we
              // hydrated from this origin's storage — verify and correct (cross-subdomain guard).
              reconcileIdentityIfMismatch();
            }).catch((error) => {
              console.warn('[useAuthInit] Background token refresh error:', error);
            });
          } else {
            reconcileIdentityIfMismatch();
          }
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        // If we have a token but no user data, fetch user profile in background
        // Token was restored from sessionStorage, so we can use it immediately
        if (token && !hasUser) {
          // Initialize immediately - don't block on user fetch
          setIsInitialized(true);
          setIsLoading(false);

          // Fetch user in background (non-blocking)
          // If token is expired, interceptor will handle refresh
          getMyProfile().then((profileResponse) => {
            if (profileResponse.success) {
              const userData = 'user' in profileResponse.data ? profileResponse.data.user : profileResponse.data;
              setUser(userData);
            } else {
              // If profile fetch fails with auth error, interceptor will handle refresh on next API call
              const errorResult = profileResponse as { success: false; error: string };
              if (
                errorResult.error?.includes('Authentication') ||
                errorResult.error?.includes('token') ||
                errorResult.error?.includes('Unauthorized')
              ) {
                // console.log('[useAuthInit] Auth error on profile fetch - interceptor will handle refresh');
              } else {
                console.warn('[useAuthInit] Failed to fetch profile:', errorResult.error);
              }
            }
          }).catch((error) => {
            console.warn('[useAuthInit] Background profile fetch error (non-blocking):', error);
          });
          return;
        }

        // If we have a persisted user but no token, first try to borrow one from another open tab.
        if (!token && hasUser) {
          const sharedToken = await requestTokenFromOtherTabs();

          if (sharedToken) {
            store.setAccessToken(sharedToken);
            // A token borrowed from another tab may be a different user than this origin's persisted
            // one (cross-subdomain) — verify and correct.
            reconcileIdentityIfMismatch();
            setIsInitialized(true);
            setIsLoading(false);
            return;
          }

          // No local token and no other tab has one — so the persisted "logged in" flag can't be
          // trusted (classic case: the app is reopened from cache after the session expired). Ask
          // the server BEFORE showing a logged-in UI, so a dead session never lets the user onto a
          // protected page only to fail on their first action (upload, etc.). This runs while the
          // init loader is up (no pages mounted yet), so it can't race the axios refresh interceptor.
          const session = await verifySession();
          if (session.status === 'valid') {
            store.setAccessToken(session.accessToken);
            // The verified session (from the shared refresh cookie) may belong to a different user
            // than this origin's persisted one — verify and correct.
            reconcileIdentityIfMismatch();
          } else if (session.status === 'invalid') {
            // Session is genuinely dead (SERVER truth) → clear the stale persisted auth and raise
            // the "session expired — log in again" modal. The navbar then reflects logged-out and
            // ProtectedRoute redirects any protected page to login.
            store.logout({ broadcast: false, reason: 'expired' });
          }
          // 'network' (server unreachable) → leave the optimistic state as-is; the interceptor
          // re-checks on the first real API call rather than logging the user out on a connectivity blip.
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        // No token and no user - try to refresh using HttpOnly cookie
        // This handles cross-subdomain scenarios where user data isn't in localStorage
        // but refresh token cookie is available (domain: .resomix.com)
        // console.log('[useAuthInit] No token and no user - attempting refresh from HttpOnly cookie');
        try {
          const refreshResult = await refreshAccessToken();
          if (refreshResult.success && refreshResult.data?.access_token) {
            // Refresh succeeded - we have a valid session via cookie
            store.setAccessToken(refreshResult.data.access_token);
            // console.log('[useAuthInit] Token refreshed from cookie, fetching user profile');
            
            // Fetch user profile now that we have a token
            const profileResponse = await getMyProfile();
            if (profileResponse.success) {
              const userData = 'user' in profileResponse.data ? profileResponse.data.user : profileResponse.data;
              setUser(userData);
              // console.log('[useAuthInit] User profile loaded successfully');
            } else {
              console.warn('[useAuthInit] Failed to fetch user profile after refresh');
            }
            
            setIsInitialized(true);
            setIsLoading(false);
            return;
          } else {
            // Refresh failed - no valid session
            // console.log('[useAuthInit] No valid refresh token cookie - user not authenticated');
            setIsInitialized(true);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          // Refresh failed - user is not authenticated
          // console.log('[useAuthInit] Refresh attempt failed - user not authenticated:', error);
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        // Don't block on init errors - let the interceptor handle auth errors
        console.warn('[useAuthInit] Init error (non-blocking):', error);
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initAuth();
  }, []); // Run once on mount

  return { isInitialized, isLoading };
};

