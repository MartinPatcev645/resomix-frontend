import { useEffect, useState } from 'react';
import { useAuthStore } from '@resomix/stores';
import { getMyProfile } from '@resomix/api-client';

/**
 * Initialize authentication state on app load
 * Verifies token validity and refreshes user data
 */
export const useAuthInit = () => {
  const { isAuthenticated, user, setUser, logout } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // If not authenticated, just mark as initialized immediately
      if (!isAuthenticated) {
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      // If we already have user data in store, show app immediately
      // and verify token in background
      if (user) {
        setIsInitialized(true);
        setIsLoading(false);
        
        // Verify token in background (non-blocking)
        verifyTokenInBackground();
        return;
      }

      // No user data yet - fetch it (first load)
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

    const verifyTokenInBackground = async () => {
      try {
        const response = await getMyProfile();
        
        if (response.success) {
          const userData = 'user' in response.data ? response.data.user : response.data;
          setUser(userData);
        } else {
          handleAuthError(response);
        }
      } catch (error) {
        console.warn('Background token verification failed:', error);
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

