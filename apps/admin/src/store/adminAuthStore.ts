import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Admin-only auth store, fully separate from the main site's `useAuthStore`.
 *
 * It uses DISTINCT storage keys (`resomix-admin-*`) so an admin session never overlaps a normal
 * user session, and it registers itself as the store the shared api-client `authClient` reads
 * (`globalThis.__RESOMIX_AUTH_STORE__`) plus points the 401-refresh flow at the admin refresh
 * endpoint — so every admin request authenticates with, and refreshes against, the admin session.
 */

const ADMIN_TOKEN_KEY = 'resomix-admin-access-token';
const ADMIN_PERSIST_KEY = 'resomix-admin-auth-storage';
const ADMIN_REFRESH_PATH = '/api/v1/admin/auth/refresh';

export interface AdminUser {
  uuid: string;
  email: string;
  name?: string | null;
  roles?: string[];
}

interface AdminAuthState {
  user: AdminUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** True while the on-load session validation runs; gates the whole app. */
  isLoading: boolean;
  setAuth: (user: AdminUser, token: string) => void;
  setAccessToken: (token: string | null) => void;
  setUser: (user: AdminUser) => void;
  setLoading: (loading: boolean) => void;
  logout: (options?: { reason?: 'user' | 'expired' }) => void;
}

const readToken = (): string | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(ADMIN_TOKEN_KEY) : null;
  } catch {
    return null;
  }
};
const writeToken = (token: string | null) => {
  try {
    if (token) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
};

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: readToken(),
      isAuthenticated: !!readToken(),
      isLoading: true, // validated on load by the admin auth-init

      setAuth: (user: AdminUser, token: string) => {
        writeToken(token);
        set({ user, accessToken: token, isAuthenticated: true });
      },
      setAccessToken: (token: string | null) => {
        writeToken(token);
        set({ accessToken: token, isAuthenticated: !!token });
      },
      setUser: (user: AdminUser) => set({ user, isAuthenticated: true }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      logout: () => {
        writeToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: ADMIN_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      // Never persist the token (sessionStorage-only) or the transient loading flag.
      partialize: (state: AdminAuthState) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);

// Make the shared authClient use THIS store + the admin refresh endpoint. Runs at module load, so
// it's in place before any api-client call (admin main.tsx imports this first).
(globalThis as unknown as Record<string, unknown>).__RESOMIX_AUTH_STORE__ = useAdminAuthStore;
(globalThis as unknown as Record<string, unknown>).__RESOMIX_AUTH_REFRESH_PATH__ = ADMIN_REFRESH_PATH;
