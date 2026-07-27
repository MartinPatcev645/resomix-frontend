import { useEffect, useRef } from 'react';
import { adminMe } from '@resomix/api-client';
import { useAdminAuthStore } from '@/store/adminAuthStore.ts';

/**
 * Validates the admin session ONCE on app load and only then lets the app render.
 *
 * A persisted "logged in" flag is never trusted on its own: we call `/admin/auth/me`, which the
 * shared client will transparently retry after refreshing against the admin cookie. If the token is
 * valid (or refreshable) we're in; if it's expired/revoked or there's no session, we log out — and
 * the route guard sends the admin to /login. `isLoading` stays true until this resolves, so no
 * protected screen ever flashes before the session is confirmed.
 */
export function useAdminAuthInit() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const store = useAdminAuthStore.getState();

    // Nothing to validate (never logged in) → go straight to the login screen.
    if (!store.isAuthenticated && !store.accessToken) {
      store.setLoading(false);
      return;
    }

    (async () => {
      const res = await adminMe();
      if (res.success && res.data) {
        useAdminAuthStore.getState().setUser(res.data);
      } else {
        // Invalid/expired session (or non-admin) — clear it; the guard redirects to /login.
        useAdminAuthStore.getState().logout();
      }
      useAdminAuthStore.getState().setLoading(false);
    })();
  }, []);
}
