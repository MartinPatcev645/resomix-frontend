import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@resomix/api-client';

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
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
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Set full authentication
      setAuth: (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
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
          refreshToken: null,
          isAuthenticated: false,
        });
        // Clear localStorage - use the correct key from persist config
        localStorage.removeItem('resomix-auth-storage');
        // Also clear any email verification banner dismissal
        localStorage.removeItem('email_verification_banner_dismissed');
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
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

