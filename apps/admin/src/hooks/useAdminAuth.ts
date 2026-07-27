import { useState } from 'react';
import {
  adminLogin,
  adminVerify2fa,
  adminLogout,
  type AdminLoginRequest,
} from '@resomix/api-client';
import { useAdminAuthStore } from '@/store/adminAuthStore.ts';
import { message } from 'antd';

/**
 * Admin auth — mandatory two-step (2FA) login:
 *   1. requestCode(email, password)          -> backend verifies credentials + emails a code
 *   2. verifyAndLogin(email, password, code)  -> backend verifies all three, issues the session
 */
export function useAdminAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once a code has been emailed (reveals the code field + "Resend" in the UI).
  const [codeSent, setCodeSent] = useState(false);

  const { setAuth, logout, user, isAuthenticated } = useAdminAuthStore();

  // Step 1 (and "Resend"): verify email + password, trigger the emailed 2FA code.
  const requestCode = async (credentials: AdminLoginRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminLogin(credentials);
      if (response.success && (response as any).data?.requires_2fa) {
        setCodeSent(true);
        message.success('A verification code has been sent to your email.');
        return true;
      }
      const errorMsg =
        (response as any).error || 'Access denied: invalid credentials or insufficient permissions.';
      setError(errorMsg);
      message.error(errorMsg);
      return false;
    } catch (err: any) {
      const errorMsg = err?.message || 'An unexpected authentication error occurred.';
      setError(errorMsg);
      message.error(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify email + password + code, and open the admin session on success.
  const verifyAndLogin = async (
    credentials: AdminLoginRequest & { code: string },
    onSuccess?: () => void,
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminVerify2fa(credentials);
      if (response.success && (response as any).data?.access_token) {
        const { user: loggedInUser, access_token } = (response as any).data;
        setAuth(loggedInUser, access_token);
        message.success('Access granted. Welcome back, Admin!');
        onSuccess?.();
        return true;
      }
      const errorMsg = (response as any).error || 'Invalid or expired verification code.';
      setError(errorMsg);
      message.error(errorMsg);
      return false;
    } catch (err: any) {
      const errorMsg = err?.message || 'An unexpected authentication error occurred.';
      setError(errorMsg);
      message.error(errorMsg);
      return false;
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
    codeSent,
    setCodeSent,
    requestCode,
    verifyAndLogin,
    handleLogout,
    user,
    isAuthenticated,
  };
}
