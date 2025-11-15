import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@resomix/stores';
import { getMyProfile } from '@resomix/api-client';

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
        const token = store.accessToken;
        const hasUser = !!store.user;

        // If we have both token and user, initialize immediately (no API call needed)
        if (token && hasUser) {
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        // If we have a token but no user data, fetch user profile in background
        // This will trigger token refresh via interceptor if token is expired
        // We initialize immediately to avoid blocking navigation, then fetch user async
        if (token && !hasUser) {
          // Initialize immediately - don't block on user fetch
          setIsInitialized(true);
          setIsLoading(false);

          // Fetch user in background (non-blocking)
          getMyProfile().then((profileResponse) => {
            if (profileResponse.success) {
              const userData = 'user' in profileResponse.data ? profileResponse.data.user : profileResponse.data;
              setUser(userData);
            } else {
              // If profile fetch fails with auth error, interceptor will handle refresh on next API call
              // If refresh fails, interceptor will logout
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

        // No token - user is not authenticated, initialize immediately
        console.log('[useAuthInit] No token found - user not authenticated');
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

