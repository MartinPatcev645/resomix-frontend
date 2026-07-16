import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@resomix/api-client';
import { hybridStorage, deleteCookie, TAB_ID } from './cookieStorage';

interface LogoutOptions {
    broadcast?: boolean;
}

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
    logout: (options?: LogoutOptions) => void;
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

            // Set full authentication
            setAuth: (user, accessToken) => {
                // A fresh login: drop any playlist cache from the prior (guest / other-user) session
                // so cached playlists can't leak across identities. Fresh data is refetched on demand.
                try {
                    const playlistModule = require('./usePlayList');
                    playlistModule.clearAllPlaylistCache();
                    // Also drop the IN-MEMORY playlist view. Clearing only localStorage left a guest's
                    // redacted "demo" copy sitting in the store, and usePlaylistLoader short-circuits
                    // (`if (playlistData) return`) on it — so after logging in the user kept seeing the
                    // anonymous teaser instead of a fresh, full refetch. Resetting forces the reload.
                    playlistModule.usePlaylistStore.getState().reset();
                } catch { /* noop if playlist store not loaded */ }

                set({
                    user,
                    accessToken,
                    isAuthenticated: true,
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
                // Clear cart state on logout
                try {
                    const cartModule = require('./useCart');
                    cartModule.useCartStore.getState().reset();
                } catch { /* noop if cart store not loaded */ }

                // Clear the playlist cache on logout so a previous user's (or guest's) cached
                // playlists are never shown to whoever logs in next on this browser.
                try {
                    const playlistModule = require('./usePlayList');
                    playlistModule.clearAllPlaylistCache();
                    // Also drop the IN-MEMORY playlist view. Clearing only localStorage left a guest's
                    // redacted "demo" copy sitting in the store, and usePlaylistLoader short-circuits
                    // (`if (playlistData) return`) on it — so after logging in the user kept seeing the
                    // anonymous teaser instead of a fresh, full refetch. Resetting forces the reload.
                    playlistModule.usePlaylistStore.getState().reset();
                } catch { /* noop if playlist store not loaded */ }

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
                        localStorage.setItem('resomix-logout', String(Date.now()));
                    } catch (e) {
                        console.warn('Unable to broadcast logout:', e);
                    }
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

        // Handle logout broadcast from other tabs
        if (event.key === 'resomix-logout' && event.newValue) {
            useAuthStore.getState().logout({ broadcast: false });
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
