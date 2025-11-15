import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@resomix/stores';
import { getMyProfile, refreshAccessToken } from '@resomix/api-client';

// Global flag to ensure initialization only happens once across the entire app
// This persists across route navigations since App.tsx doesn't remount
let globalHasInitialized = false;

/**
 * Initialize authentication state on app load
 * Only checks for existing token/user - does NOT proactively refresh tokens
 * Token refresh is handled by authClient interceptor on 401 errors
 * This prevents unnecessary refresh calls and loaders on page navigation
 */
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
            console.log('[useAuthInit] Token expired, refreshing in background');
            refreshAccessToken().then((refreshResult) => {
              if (refreshResult.success && refreshResult.data?.access_token) {
                store.setAccessToken(refreshResult.data.access_token);
              } else {
                // Refresh failed - token may be invalid, but don't logout yet
                // Let the interceptor handle it on the next API call
                console.warn('[useAuthInit] Background token refresh failed');
              }
            }).catch((error) => {
              console.warn('[useAuthInit] Background token refresh error:', error);
            });
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
                console.log('[useAuthInit] Auth error on profile fetch - interceptor will handle refresh');
              } else {
                console.warn('[useAuthInit] Failed to fetch profile:', errorResult.error);
              }
            }
          }).catch((error) => {
            console.warn('[useAuthInit] Background profile fetch error (non-blocking):', error);
          });
          return;
        }

        // If we have a user but no token, refresh the token
        // This should be rare now since token is persisted in sessionStorage
        if (!token && hasUser) {
          console.log('[useAuthInit] User found but no token - refreshing token');
          try {
            const refreshResult = await refreshAccessToken();
            if (refreshResult.success && refreshResult.data?.access_token) {
              store.setAccessToken(refreshResult.data.access_token);
              console.log('[useAuthInit] Token refreshed successfully');
              setIsInitialized(true);
              setIsLoading(false);
              return;
            } else {
              // Refresh failed - user session may have expired
              console.warn('[useAuthInit] Token refresh failed, logging out');
              store.logout();
              setIsInitialized(true);
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.warn('[useAuthInit] Token refresh error:', error);
            store.logout();
            setIsInitialized(true);
            setIsLoading(false);
            return;
          }
        }

        // No token and no user - user is not authenticated, initialize immediately
        console.log('[useAuthInit] No token and no user - user not authenticated');
        setIsInitialized(true);
        setIsLoading(false);
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

