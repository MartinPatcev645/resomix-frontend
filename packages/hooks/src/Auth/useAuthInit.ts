import { useEffect, useState } from 'react';
import { useAuthStore } from '@resomix/stores';
import { getMyProfile } from '@resomix/api-client';

/**
 * Initialize authentication state on app load
 * Verifies token validity and refreshes user data
 */
export const useAuthInit = () => {
  const { isAuthenticated, setUser, logout } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // If not authenticated, just mark as initialized
      if (!isAuthenticated) {
        setIsInitialized(true);
        setIsLoading(false);
        return;
      }

      try {
        // Verify token and refresh user data
        const response = await getMyProfile();
        
        if (response.success) {
          // Handle both response formats: direct user or nested user
          const userData = 'user' in response.data ? response.data.user : response.data;
          setUser(userData);
        } else {
          // Only logout if it's actually an auth error (401)
          // Don't logout on network errors or server errors
          const errorResult = response as { success: false; error: string };
          if (errorResult.error?.includes('Authentication') || 
              errorResult.error?.includes('token') || 
              errorResult.error?.includes('Unauthorized')) {
            console.warn('Token invalid or expired, logging out');
            logout();
          } else {
            // Network or server error - keep user logged in
            console.warn('Failed to verify auth, but keeping session:', errorResult.error);
          }
        }
      } catch (error) {
        // Network error - don't logout, just log warning
        console.warn('Network error during auth init, keeping session:', error);
        // Keep the user logged in - they might just have a temporary connection issue
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initAuth();
  }, []); // Run once on mount

  return { isInitialized, isLoading };
};

