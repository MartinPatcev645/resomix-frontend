import { useEffect, useState } from 'react';
import { useAuthStore } from '@resomix/stores';
import { refreshAccessToken } from '@resomix/api-client';

/**
 * Monitor session timeout and show warning before expiration
 * Automatically refresh token when it's about to expire
 */
export const useSessionTimeout = () => {
  const { accessToken, refreshToken, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setShowWarning(false);
      setTimeLeft(null);
      return;
    }

    // Check token expiration
    const checkExpiration = () => {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const exp = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const remaining = exp - now;

        setTimeLeft(remaining);

        // Show warning 2 minutes (120000ms) before expiration
        if (remaining < 120000 && remaining > 0) {
          setShowWarning(true);
        } else if (remaining <= 0) {
          // Token expired
          setShowWarning(false);
          logout();
        } else {
          setShowWarning(false);
        }
      } catch (error) {
        console.error('Token parsing error:', error);
        logout();
      }
    };

    // Check immediately
    checkExpiration();

    // Check every 30 seconds
    const interval = setInterval(checkExpiration, 30000);
    
    return () => clearInterval(interval);
  }, [accessToken, logout]);

  /**
   * Extend the session by refreshing the access token
   */
  const extendSession = async () => {
    if (!refreshToken) {
      logout();
      return false;
    }

    try {
      const response = await refreshAccessToken(refreshToken);
      
      if (response.success && 'access_token' in response.data) {
        const { setAccessToken } = useAuthStore.getState();
        setAccessToken(response.data.access_token);
        setShowWarning(false);
        return true;
      } else {
        logout();
        return false;
      }
    } catch (error) {
      console.error('Session extension error:', error);
      logout();
      return false;
    }
  };

  return { 
    showWarning, 
    timeLeft,
    extendSession 
  };
};

