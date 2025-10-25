import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@resomix/api-client';
import { hybridStorage, deleteCookie } from './cookieStorage';

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  
  // Utility
  isTokenExpired: () => boolean;
  getAuthHeader: () => string | null;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Set full authentication
      setAuth: (user, accessToken) => {
        set({
          user,
          accessToken,
          isAuthenticated: true,
        });
      },

      // Update access token (after refresh)
      setAccessToken: (token) => {
        set({ accessToken: token });
      },

      // Update user data
      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      // Logout
      logout: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
        // Clear both localStorage and cookies
        try {
          localStorage.removeItem('resomix-auth-storage');
          localStorage.removeItem('email_verification_banner_dismissed');
        } catch (e) {
          console.warn('localStorage not available:', e);
        }
        deleteCookie('resomix-auth-storage');
      },

      // Update user fields
      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },

      // Check if token is expired (JWT has exp claim)
      isTokenExpired: () => {
        const token = get().accessToken;
        if (!token) return true;

        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const exp = payload.exp * 1000; // Convert to milliseconds
          return Date.now() >= exp;
        } catch {
          return true;
        }
      },

      // Get Authorization header value
      getAuthHeader: () => {
        const token = get().accessToken;
        return token ? `Bearer ${token}` : null;
      },
    }),
    {
      name: 'resomix-auth-storage',
      storage: createJSONStorage(() => hybridStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Expose store to global scope for authClient to access
// This avoids circular dependency issues
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__RESOMIX_AUTH_STORE__ = useAuthStore;
}

export { useAuthStore };
export type { AuthState };

