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
        
        if (response.success && 'user' in response.data) {
          setUser(response.data.user);
        } else {
          // Token invalid or expired, logout
          logout();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Token invalid, logout
        logout();
      } finally {
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initAuth();
  }, []); // Run once on mount

  return { isInitialized, isLoading };
};

