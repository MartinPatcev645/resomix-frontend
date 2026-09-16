import { useEffect } from 'react';
import { useAuthStore } from '@resomix/stores';
import { pushUserIdentified, pushUserLogout } from './dataLayer';

/**
 * Keeps the GTM dataLayer in step with who is signed in, so PostHog can attribute events to a
 * person rather than to an anonymous browser id.
 *
 * It watches the auth store rather than hooking each login form, which is what makes it complete:
 * password login, Google sign-in and One Tap, a session restored from the shared refresh cookie on
 * page load, and the cross-subdomain identity reconciliation all end at the same store, and so all
 * announce themselves here. Logout is the same story in reverse: the user clicking log out, the
 * session expiring and an account being deactivated all clear the store.
 *
 * Call it once per app, next to `useGoogleTagManager`.
 */
export function useAnalyticsIdentity(): void {
  const userId = useAuthStore((state) => state.user?.uuid ?? null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && userId) {
      pushUserIdentified(userId);
      return;
    }
    // Only pushes if somebody was identified in this page load, so a guest emits nothing.
    pushUserLogout();
  }, [isAuthenticated, userId]);
}
