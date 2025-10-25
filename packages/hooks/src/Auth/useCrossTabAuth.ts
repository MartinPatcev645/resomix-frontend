import { useEffect } from 'react';
import { useAuthStore } from '@resomix/stores';

/**
 * Sync authentication state across browser tabs/windows
 * This hook listens to localStorage changes and updates the auth state
 * when auth changes occur in other tabs
 */
export const useCrossTabAuth = () => {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'resomix-auth-storage') {
        const { logout, setAuth } = useAuthStore.getState();
        
        if (e.newValue === null) {
          // Logged out in another tab
          logout();
        } else {
          // Auth updated in another tab
          try {
            const newState = JSON.parse(e.newValue);
            if (newState.state) {
              const { user, accessToken } = newState.state;
              if (user && accessToken) {
                setAuth(user, accessToken);
              }
            }
          } catch (error) {
            console.error('Failed to sync auth state:', error);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
};

