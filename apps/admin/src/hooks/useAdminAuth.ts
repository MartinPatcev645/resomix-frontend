import { useState } from 'react';
import { adminLogin, adminLogout, type AdminLoginRequest } from '@resomix/api-client';
import { useAdminAuthStore } from '@/store/adminAuthStore.ts';
import { message } from 'antd';

export function useAdminAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setAuth, logout, user, isAuthenticated } = useAdminAuthStore();

  const handleLogin = async (credentials: AdminLoginRequest, onSuccess?: () => void) => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminLogin(credentials);
      if (response.success && response.data) {
        const { user: loggedInUser, access_token } = response.data;
        
        // Save administrative session to our global store
        setAuth(loggedInUser, access_token);
        
        message.success('Access granted. Welcome back, Admin!');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const errorMsg = (response as any).error || 'Access denied: Invalid credentials or insufficient permissions.';
        setError(errorMsg);
        message.error(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'An unexpected authentication error occurred.';
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear the server-side admin refresh cookie first, then the local session. The route guard
      // then redirects to /login on the next render.
      await adminLogout();
    } catch (err) {
      console.error('Admin logout (server) error:', err);
    } finally {
      logout();
      message.success('Logged out successfully.');
    }
  };

  return {
    loading,
    error,
    user,
    isAuthenticated,
    handleLogin,
    handleLogout,
  };
}
