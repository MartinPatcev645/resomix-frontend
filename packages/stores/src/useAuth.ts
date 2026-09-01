import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@resomix/api-client';
import { hybridStorage, deleteCookie, TAB_ID } from './cookieStorage';
// Static ESM imports, NOT `require()`.
//
// These three call sites used to use `require('./usePlayList')` / `require('./useCart')` inside
// try/catch. `require` does not exist in an ESM browser bundle, so Vite shipped the call verbatim,
// it threw ReferenceError on the first statement, and the bare `catch` swallowed it. The result:
// the playlist and cart resets below have never once run in production. A guest's playlist stayed
// in the store after login (only a page refresh cleared it), and a logged-out user's cart and
// playlist were handed to whoever logged in next on the same browser.
//
// Safe as static imports: neither module imports this one, so there is no cycle. They are imported
// by path rather than through './index' for the same reason.
import { clearAllPlaylistCache, usePlaylistStore } from './usePlayList';
import { useCartStore } from './useCart';

interface LogoutOptions {
    broadcast?: boolean;
    /**
     * Why the logout happened. "expired" = the SERVER invalidated the session (refresh 401/403,
     * verifySession invalid) — the UI shows a "session expired, please log in again" modal.
     * "user" (default) = the user clicked logout — no modal.
     */
    /**
     * Why the session ended, which decides what (if anything) the user is told:
     *  - 'user'        they clicked log out — say nothing
     *  - 'expired'     the server invalidated the session — "please log in again"
     *  - 'deactivated' the account was deactivated or deleted — logging in again will NOT help,
     *                  so this needs its own explanation rather than the expiry copy
     */
    reason?: 'user' | 'expired' | 'deactivated';
}

interface AuthState {
    // State
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    /** True after a server-side session invalidation → App shows the "log in again" modal. */
    sessionExpired: boolean;
    /** Set when the session ended because the ACCOUNT was deactivated, not merely expired. */
    accountDeactivated: boolean;

    // Actions
    setAuth: (user: User, accessToken: string) => void;
    setAccessToken: (token: string) => void;
    setUser: (user: User) => void;
    logout: (options?: LogoutOptions) => void;
    /** Dismiss (or programmatically raise) the session-expired modal. */
    setSessionExpired: (value: boolean) => void;
    setAccountDeactivated: (value: boolean) => void;
    updateUser: (updates: Partial<User>) => void;

    // Utility
    isTokenExpired: () => boolean;
    getAuthHeader: () => string | null;
}

// Initialize access token from sessionStorage on store creation
// This restores the token immediately on page reload without waiting for refresh
const getInitialAccessToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage.getItem('resomix-access-token');
    } catch {
        return null;
    }
};

const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Initial State - restore access token from sessionStorage if available
            user: null,
            accessToken: getInitialAccessToken(),
            isAuthenticated: false,
            isLoading: false,
            sessionExpired: false,
            accountDeactivated: false,

            // Set full authentication
            setAuth: (user, accessToken) => {
                // A fresh login: drop any playlist state from the prior (guest / other-user) session
                // so it can't leak across identities. Fresh data is refetched on demand.
                //
                // `clearAllPlaylistCache()` only purges two legacy localStorage keys that nothing
                // writes any more. The reset below is the part that matters: it drops the IN-MEMORY
                // playlist, which is what a guest was still being shown after logging in.
                //
                // `usePlaylistLoader` re-fetches because its effect keys on the auth identity as
                // well as the playlist id. Without that, this reset would leave the page on a
                // loader forever when login happens in place (Google One Tap does not navigate).
                clearAllPlaylistCache();
                usePlaylistStore.getState().reset();

                set({
                    user,
                    accessToken,
                    isAuthenticated: true,
                    sessionExpired: false, // fresh login clears any pending "session expired" modal
                    accountDeactivated: false,
                });
                // Also persist access token in sessionStorage
                if (typeof window !== 'undefined' && accessToken) {
                    try {
                        window.sessionStorage.setItem('resomix-access-token', accessToken);
                    } catch (e) {
                        console.warn('sessionStorage not available for access token:', e);
                    }
                }
            },

            // Update access token (after refresh)
            // Store in both memory (Zustand state) and sessionStorage for persistence across page reloads
            setAccessToken: (token) => {
                // If we're setting a token, mark as authenticated (token will be validated by backend)
                // If we're clearing the token, mark as not authenticated
                set({ 
                    accessToken: token,
                    isAuthenticated: !!token 
                });
                // Persist access token in sessionStorage (cleared on tab close, more secure than localStorage)
                // This allows token to persist across page reloads without showing a loader
                if (typeof window !== 'undefined') {
                    try {
                        if (token) {
                            window.sessionStorage.setItem('resomix-access-token', token);
                            // Broadcast token update to other tabs via localStorage event
                            // This ensures all tabs have the latest token after refresh
                            try {
                                localStorage.setItem('resomix-token-update', JSON.stringify({ token, timestamp: Date.now() }));
                                // Remove immediately to trigger storage event and avoid cluttering localStorage
                                setTimeout(() => {
                                    try {
                                        localStorage.removeItem('resomix-token-update');
                                    } catch (e) {
                                        // Ignore cleanup errors
                                    }
                                }, 100);
                            } catch (e) {
                                // If localStorage is unavailable, that's okay - sessionStorage is per-tab anyway
                            }
                        } else {
                            window.sessionStorage.removeItem('resomix-access-token');
                        }
                    } catch (e) {
                        console.warn('sessionStorage not available for access token:', e);
                    }
                }
            },

            // Update user data
            setUser: (user) => {
                set({ user, isAuthenticated: true });
            },

            // Logout
            logout: (options?: LogoutOptions) => {
                // Clear cart state on logout. Neither store is persisted, so this only drops
                // in-memory state in this tab — but that is exactly the state the next person to
                // log in on a shared browser would otherwise inherit.
                useCartStore.getState().reset();

                // Same for the playlist, so a previous user's (or guest's) playlist is never shown
                // to whoever logs in next on this browser.
                clearAllPlaylistCache();
                usePlaylistStore.getState().reset();

                set({
                    user: null,
                    accessToken: null,
                    isAuthenticated: false,
                    // Server-invalidated sessions raise the "log in again" modal; a user-initiated
                    // logout must never show it.
                    sessionExpired: options?.reason === 'expired',
                    // A deactivated account must NOT raise the expiry modal — "log in again"
                    // is advice that cannot work, and sending them round that loop is worse
                    // than saying nothing.
                    accountDeactivated: options?.reason === 'deactivated',
                });
                // Clear both localStorage and cookies
                try {
                    localStorage.removeItem('resomix-auth-storage');
                    localStorage.removeItem('email_verification_banner_dismissed');
                } catch (e) {
                    console.warn('localStorage not available:', e);
                }
                // Clear access token from sessionStorage
                if (typeof window !== 'undefined') {
                    try {
                        window.sessionStorage.removeItem('resomix-access-token');
                        // Broadcast sessionStorage clear to other tabs via localStorage event
                        // Other tabs will listen for this and clear their sessionStorage too
                        if (options?.broadcast !== false) {
                            localStorage.setItem('resomix-session-clear', String(Date.now()));
                            // Remove immediately to trigger storage event
                            localStorage.removeItem('resomix-session-clear');
                        }
                    } catch (e) {
                        console.warn('sessionStorage not available:', e);
                    }
                }
                if (options?.broadcast !== false) {
                    try {
                        // Carry the reason so other tabs can also raise the session-expired modal.
                        localStorage.setItem('resomix-logout', JSON.stringify({ ts: Date.now(), reason: options?.reason ?? 'user' }));
                    } catch (e) {
                        console.warn('Unable to broadcast logout:', e);
                    }
                }
                deleteCookie('resomix-auth-storage');
            },

            setSessionExpired: (value) => set({ sessionExpired: value }),

            setAccountDeactivated: (value) => set({ accountDeactivated: value }),

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
                isAuthenticated: state.isAuthenticated,
            }),
            version: 1,
            migrate: (persistedState: any, version) => {
                if (version < 1 && persistedState) {
                    const { accessToken: _removed, ...rest } = persistedState;
                    return rest;
                }
                return persistedState;
            },
        }
    )
);

// Expose store to global scope for authClient to access
// This avoids circular dependency issues
if (typeof globalThis !== 'undefined') {
    (globalThis as any).__RESOMIX_AUTH_STORE__ = useAuthStore;
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.storageArea !== window.localStorage) return;

        // Handle logout broadcast from other tabs (value carries the reason; legacy plain-timestamp
        // values parse as a user-initiated logout).
        if (event.key === 'resomix-logout' && event.newValue) {
            let reason: 'user' | 'expired' | 'deactivated' = 'user';
            try {
                const parsed = JSON.parse(event.newValue);
                // Carry 'deactivated' across tabs too, or the other tabs would show
                // "session expired — log in again" for an account that cannot log in.
                if (parsed && (parsed.reason === 'expired' || parsed.reason === 'deactivated')) {
                    reason = parsed.reason;
                }
            } catch { /* legacy format — treat as user logout */ }
            useAuthStore.getState().logout({ broadcast: false, reason });
            return;
        }

        // Handle sessionStorage clear broadcast (when logout happens in another tab)
        if (event.key === 'resomix-session-clear' && event.newValue) {
            try {
                window.sessionStorage.removeItem('resomix-access-token');
            } catch (e) {
                console.warn('Failed to clear sessionStorage token:', e);
            }
            return;
        }

        // Handle token update broadcast (when refresh happens in another tab)
        if (event.key === 'resomix-token-update' && event.newValue) {
            try {
                const update = JSON.parse(event.newValue);
                if (update.token && typeof update.token === 'string') {
                    // Update state directly — do NOT call setAccessToken() which re-broadcasts
                    window.sessionStorage.setItem('resomix-access-token', update.token);
                    useAuthStore.setState({
                        accessToken: update.token,
                        isAuthenticated: true,
                    });
                }
            } catch (e) {
                console.warn('Failed to sync token from other tab:', e);
            }
            return;
        }

        // Handle token request from a new tab
        if (event.key === 'resomix-token-request' && event.newValue) {
            const token = useAuthStore.getState().accessToken;
            if (token) {
                // Broadcast our token to the requesting tab
                localStorage.setItem('resomix-token-update', JSON.stringify({
                    token,
                    timestamp: Date.now(),
                    tabId: TAB_ID
                }));
                // Delay cleanup to ensure the requesting tab receives the storage event
                setTimeout(() => {
                    try { localStorage.removeItem('resomix-token-update'); } catch { /* noop */ }
                }, 100);
            }
            return;
        }

        // Handle auth state rehydration from other tabs
        if (event.key === 'resomix-auth-storage' && event.newValue) {
            // Skip if this write was made by the current tab (envelope contains tabId)
            try {
                const parsed = JSON.parse(event.newValue);
                if (parsed?.tabId === TAB_ID) return;
            } catch { /* proceed with rehydrate */ }
            const persistApi = (useAuthStore as any).persist;
            if (persistApi?.rehydrate) {
                persistApi.rehydrate();
            }
        }
    });
}

export { useAuthStore };
export type { AuthState };
