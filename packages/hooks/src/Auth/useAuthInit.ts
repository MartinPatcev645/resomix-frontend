import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@resomix/stores';
import { getMyProfile } from '@resomix/api-client';

/**
 * Initialize authentication state on app load
 * Verifies token validity only when necessary
 * Prevents redundant /me API calls
 */
export const useAuthInit = () => {
  const { isAuthenticated, user, setUser, logout } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initAuth = async () => {
      // If not authenticated, just mark as initialized immediately
      if (!isAuthenticated) {
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // If we already have user data in store, trust it and show app immediately
      // Don't make unnecessary API calls - the authClient interceptor will handle
      // token refresh if needed when the user actually makes requests
      if (user) {
        setIsInitialized(true);
        setIsLoading(false);
        // No background verification needed - interceptor handles token refresh on-demand
        return;
      }

      // No user data yet - fetch it (first load after login)
      try {
        const response = await getMyProfile();
        
        if (response.success) {
          const userData = 'user' in response.data ? response.data.user : response.data;
          setUser(userData);
        } else {
          handleAuthError(response);
        }
      } catch (error) {
        console.warn('Network error during auth init, keeping session:', error);
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };


    const handleAuthError = (response: any) => {
      const errorResult = response as { success: false; error: string };
      if (errorResult.error?.includes('Authentication') || 
          errorResult.error?.includes('token') || 
          errorResult.error?.includes('Unauthorized')) {
        console.warn('Token invalid or expired, logging out');
        logout();
      } else {
        console.warn('Failed to verify auth, but keeping session:', errorResult.error);
      }
    };

    initAuth();
  }, []); // Run once on mount

  return { isInitialized, isLoading };
};

