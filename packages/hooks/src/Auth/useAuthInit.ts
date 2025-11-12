import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@resomix/stores';
import { getMyProfile, refreshAccessToken } from '@resomix/api-client';

/**
 * Initialize authentication state on app load
 * Verifies token validity only when necessary
 * Prevents redundant /me API calls
 */
export const useAuthInit = () => {
  const { setUser } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initAuth = async () => {
      setIsLoading(true);
      const store = useAuthStore.getState();

      try {
        let token = store.accessToken;
        const tokenExpired = store.isTokenExpired();

        if (!token || tokenExpired) {
          const refreshResult = await refreshAccessToken();

          if (refreshResult.success && refreshResult.data?.access_token) {
            token = refreshResult.data.access_token;
            store.setAccessToken(token);
          } else {
            store.logout();
        return;
      }
        }

        if (!store.user) {
          const profileResponse = await getMyProfile();
        
          if (profileResponse.success) {
            const userData = 'user' in profileResponse.data ? profileResponse.data.user : profileResponse.data;
          setUser(userData);
        } else {
            handleAuthError(profileResponse);
          }
        }
      } catch (error) {
        console.warn('Auth init error, logging out:', error);
        store.logout();
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };


    const handleAuthError = (response: any) => {
      const errorResult = response as { success: false; error: string };
      const store = useAuthStore.getState();

      if (
        errorResult.error?.includes('Authentication') ||
          errorResult.error?.includes('token') || 
        errorResult.error?.includes('Unauthorized')
      ) {
        console.warn('Token invalid or expired, logging out');
        store.logout();
      } else {
        console.warn('Failed to verify auth, but keeping session:', errorResult.error);
      }
    };

    initAuth();
  }, []); // Run once on mount

  return { isInitialized, isLoading };
};

