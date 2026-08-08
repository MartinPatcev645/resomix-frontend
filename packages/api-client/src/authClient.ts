import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './config';
import { getDeviceHash, initDeviceHash } from './deviceId';

// Import will be added after useAuthStore is created
// For now, we'll use dynamic import to avoid circular dependencies
const getAuthStore = () => {
  try {
    // Dynamic import to access Zustand store from another package
    return (globalThis as Record<string, unknown>).__RESOMIX_AUTH_STORE__ as any;
  } catch {
    return null;
  }
};

// Which endpoint the 401-refresh flow calls. The admin app overrides this (via
// `globalThis.__RESOMIX_AUTH_REFRESH_PATH__`) so it refreshes against ITS own session/cookie
// (`/admin/auth/refresh`), never the main site's `/auth/refresh`.
const getRefreshPath = (): string => {
  const override = (globalThis as Record<string, unknown>).__RESOMIX_AUTH_REFRESH_PATH__;
  return typeof override === 'string' && override ? override : API_CONFIG.ENDPOINTS.AUTH_REFRESH;
};

const API_BASE_URL = API_CONFIG.BASE_URL;
const API_TIMEOUT = 300_000; // 5 minutes (matches existing setup)

// Create axios instance
const authClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cross-subdomain cookies
});

// Track if we're currently refreshing token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - attach the user's JWT (and the guest device signal). The retired static
// api_key is no longer sent: guests are anonymous (→ System Partner 1), logged-in users and admins
// are identified by their JWT from the auth store (admins log in via /admin/auth/login).
authClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const isAdminRoute = config.url?.includes('admin') || config.url?.includes('/admin/');

    // Guest device signal for server-side visitor_id derivation (not on admin routes).
    if (!isAdminRoute) {
      // AWAIT the hash, never just peek at it. `getDeviceHash()` is synchronous and returns null
      // until the fingerprint has been computed, so the FIRST requests of a session — including the
      // `/entitlements/me` fetch that fires at bootstrap — would go out without the header. The
      // server then derives a *different*, degraded visitor id for those, which splits one guest's
      // usage across two identities: they get extra free searches, and the usage chip reads a
      // different counter than enforcement wrote to.
      //
      // Cached after the first call (memory + localStorage), so this costs nothing thereafter.
      const deviceHash = getDeviceHash() ?? (await initDeviceHash());
      if (deviceHash) {
        config.headers['X-Device-Hash'] = deviceHash;
      }
    }

    // Add auth token if available
    const authStore = getAuthStore();
    if (authStore) {
      const state = authStore.getState();
      let { accessToken, isAuthenticated } = state;

      // If user is authenticated but no token, log it
      // The response interceptor will handle 401 and refresh the token
      if (isAuthenticated && !accessToken) {
        // console.log(`[authClient] User authenticated but no token for ${config.url} - request will proceed, refresh will happen on 401`);
      }

      // Add authorization header if token exists and user is authenticated
      // Don't check isTokenExpired here - let the backend decide and use refresh interceptor
      if (accessToken && isAuthenticated) {
        config.headers.Authorization = `Bearer ${accessToken}`;
        // console.log(`[authClient] Added Authorization header for ${config.url}`);
      } else if (isAuthenticated && !accessToken) {
        // console.log(`[authClient] No auth token for ${config.url} - accessToken: ${!!accessToken}, isAuthenticated: ${isAuthenticated}, user: ${!!state.user} - refresh attempt initiated`);
      } else {
        // console.log(`[authClient] No auth token for ${config.url} - accessToken: ${!!accessToken}, isAuthenticated: ${isAuthenticated}, user: ${!!state.user}`);
      }
    } else {
      console.warn(`[authClient] Auth store not available for ${config.url} - global store: ${!!(globalThis as Record<string, unknown>).__RESOMIX_AUTH_STORE__}`);
    }

    // Support for Idempotency-Key
    const customConfig = config as any;
    if (customConfig.idempotencyKey) {
      config.headers['Idempotency-Key'] = customConfig.idempotencyKey;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle token refresh
authClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn(`Rate limited. Retry after: ${retryAfter || '60'} seconds`);
    }

    // CRITICAL: Prevent infinite loop - never try to refresh the refresh endpoint itself
    const isRefreshEndpoint = originalRequest.url?.includes(getRefreshPath());
    if (isRefreshEndpoint) {
      // console.log('[authClient] 401 on refresh endpoint - not attempting refresh to prevent infinite loop');
      return Promise.reject(error);
    }

    // The account was deactivated mid-session — by an admin, or by the user deleting it from
    // another tab. The server revokes every session at the same moment, so there is nothing left
    // to refresh and no way for this request to succeed on a retry.
    //
    // Handled here rather than at call sites because it can surface on ANY request, and a
    // deactivated user would otherwise see a different unexplained failure on whichever screen
    // they happened to be on. Logging out immediately also keeps the tabs consistent: the store
    // broadcasts, so every open tab raises the same explanation.
    //
    // A 403 is deliberately NOT part of the refresh flow below — refreshing would fail anyway, and
    // 403 means "we know who you are and the answer is still no".
    if (error.response?.status === 403) {
      const body = error.response.data as { error?: { code?: string } | string; code?: string } | undefined;
      const nested = typeof body?.error === "object" ? body?.error : undefined;
      if ((nested?.code ?? body?.code) === "ACCOUNT_DEACTIVATED") {
        const authStore = getAuthStore();
        if (authStore?.getState().isAuthenticated) {
          authStore.getState().logout({ reason: "deactivated" });
        }
        return Promise.reject(error);
      }
    }

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // console.log(`[authClient] 401 error for ${originalRequest.url}, attempting token refresh...`);

      const authStore = getAuthStore();
      if (!authStore) {
        // console.log('[authClient] Auth store not available, cannot refresh token');
        return Promise.reject(error);
      }

      const { setAccessToken, logout, accessToken, isAuthenticated } = authStore.getState();
      
      // Check if user logged out during refresh attempt
      // Attempt refresh if user is authenticated (even if accessToken is missing)
      // This handles cases where isAuthenticated=true but accessToken was cleared from sessionStorage
      if (!isAuthenticated) {
        // console.log('[authClient] User not authenticated, skipping refresh');
        return Promise.reject(error);
      }

      // If we have no access token but user is authenticated, attempt refresh from HttpOnly cookie
      if (!accessToken) {
        // console.log('[authClient] User authenticated but no access token - attempting refresh from cookie');
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        // console.log(`[authClient] Token refresh in progress, queueing request for ${originalRequest.url}`);
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return authClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // console.log('[authClient] Refreshing access token...');
        // Attempt to refresh token - no body needed, server reads from HttpOnly cookie
        const response = await axios.post(
          `${API_BASE_URL}${getRefreshPath()}`,
          {}, // Empty body - server manages refresh token via HttpOnly cookie
          {
            withCredentials: true, // Include cookies (server reads the refresh token from an HttpOnly cookie)
          }
        );

        if (response.data.success) {
          const newAccessToken = response.data.data.access_token;
          // console.log(`[authClient] Token refresh successful, retrying ${originalRequest.url}`);
          setAccessToken(newAccessToken);

          // Update authorization header
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          // Process queued requests
          processQueue(null, newAccessToken);

          isRefreshing = false;

          // Retry original request
          return authClient(originalRequest);
        } else {
          console.error('[authClient] Token refresh failed - invalid response');
          throw new Error('Token refresh failed');
        }
      } catch (refreshError) {
        /*
         * A 401 here is the EXPECTED outcome for an anonymous visitor.
         *
         * useAuthInit attempts a refresh on first load even with no local token, because the
         * refresh cookie is scoped to `.resomix.com` and may carry a session started on the beta
         * subdomain. With no cookie the server correctly answers 401 — nothing has gone wrong, and
         * the caller already handles it. Logging it as an error put a red entry in the console of
         * every logged-out visit, which is what Lighthouse's "Browser errors were logged to the
         * console" audit reported. Anything OTHER than a 401 is still a real problem worth shouting
         * about.
         */
        const refreshStatusCode = axios.isAxiosError(refreshError)
          ? refreshError.response?.status
          : undefined;
        if (refreshStatusCode !== 401) {
          console.error('[authClient] Token refresh failed', refreshError);
        }
        
        // Check if user logged out during refresh
        const currentState = authStore.getState();
        if (!currentState.isAuthenticated) {
          // console.log('[authClient] User logged out during refresh, aborting');
          processQueue(refreshError, null);
          isRefreshing = false;
          return Promise.reject(refreshError);
        }

        // Distinguish between network errors and auth errors
        if (typeof window !== 'undefined' && axios.isAxiosError(refreshError)) {
          const refreshStatus = refreshError.response?.status;
          const refreshMessage = (refreshError.response?.data as { error?: string })?.error;
          const isNetworkError = !refreshError.response; // No response = network error
          
          // Only logout on auth errors (401, 403), not on network errors
          if (isNetworkError) {
            console.warn('[authClient] Network error during refresh - will retry on next request');
            processQueue(refreshError, null);
            isRefreshing = false;
            return Promise.reject(refreshError);
          }
          
          // Handle refresh token reuse detection
          if (
            refreshStatus === 401 &&
            typeof refreshMessage === 'string' &&
            refreshMessage.toLowerCase().includes('refresh token reuse detected')
          ) {
            try {
              window.sessionStorage.setItem('auth_logout_reason', 'refresh_token_reuse');
            } catch (storageError) {
              console.warn('Unable to persist logout reason:', storageError);
            }
          }
        }
        
        // Only logout on auth errors (401, 403), not on network errors. This is the SERVER
        // invalidating the session — pass reason "expired" so the UI raises the
        // "session expired, please log in again" modal (in every tab, via the logout broadcast).
        processQueue(refreshError, null);
        logout({ reason: 'expired' });
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Interceptor to log correlation ID for debugging
authClient.interceptors.response.use((response) => {
  const correlationId = response.headers['x-correlation-id'];
  if (correlationId) {
    // console.log(`[Auth API] Correlation-ID: ${correlationId} for ${response.config.url}`);
  }
  return response;
}, (error) => {
  if (error.response?.headers['x-correlation-id']) {
    console.error(`[Auth API Error] Correlation-ID: ${error.response.headers['x-correlation-id']} for ${error.config?.url}`);
  }
  return Promise.reject(error);
});

export default authClient;

