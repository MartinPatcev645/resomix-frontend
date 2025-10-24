# Frontend Integration Guide - ResomiX Authentication

**Version:** 1.0.0  
**Last Updated:** October 24, 2025  
**Stack:** React 19.x + Vite + Zustand 5.0.x

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Architecture](#authentication-architecture)
3. [Setup & Configuration](#setup--configuration)
4. [Zustand Store Implementation](#zustand-store-implementation)
5. [API Client Setup](#api-client-setup)
6. [Authentication Endpoints](#authentication-endpoints)
7. [User Profile Endpoints](#user-profile-endpoints)
8. [Optional Authentication Endpoints](#optional-authentication-endpoints)
9. [Cross-Subdomain Authentication](#cross-subdomain-authentication)
10. [Error Handling](#error-handling)
11. [Best Practices](#best-practices)

---

## 📦 Monorepo Setup Summary

This guide is tailored for your **pnpm workspace + Turbo monorepo** structure. All authentication code will be organized as follows:

### Package Structure

```
resomix-web/
├── packages/
│   ├── api-client/          # Shared API layer
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   └── auth.ts           # ✨ NEW: Auth types
│   │   │   ├── auth/
│   │   │   │   ├── login.ts          # ✨ NEW: Login endpoint
│   │   │   │   ├── register.ts       # ✨ NEW: Register endpoint
│   │   │   │   ├── verify2FA.ts      # ✨ NEW: 2FA verification
│   │   │   │   └── ...               # ✨ NEW: Other auth endpoints
│   │   │   ├── authClient.ts         # ✨ NEW: Auth-aware axios client
│   │   │   ├── utils.ts              # ✅ Existing (extends for auth)
│   │   │   ├── config.ts             # ✅ Existing
│   │   │   └── index.ts              # ✅ Existing (add auth exports)
│   │   └── package.json
│   │
│   ├── stores/              # Shared state management
│   │   ├── src/
│   │   │   ├── useAuth.ts            # ✨ NEW: Auth store (Zustand)
│   │   │   ├── usePlayer.ts          # ✅ Existing
│   │   │   ├── usePlayList.ts        # ✅ Existing
│   │   │   └── index.ts              # ✅ Existing (add useAuth export)
│   │   └── package.json
│   │
│   └── hooks/               # Shared React hooks
│       ├── src/
│       │   ├── Auth/
│       │   │   ├── useCrossTabAuth.ts   # ✨ NEW: Tab sync
│       │   │   ├── useAuthInit.ts       # ✨ NEW: Auth initialization
│       │   │   └── useSessionTimeout.ts # ✨ NEW: Session warnings
│       │   ├── Player/              # ✅ Existing
│       │   ├── Waveform/            # ✅ Existing
│       │   └── index.ts             # ✅ Existing (add Auth exports)
│       └── package.json
│
└── apps/
    ├── webapp/              # Main app
    │   ├── src/
    │   │   ├── components/
    │   │   │   ├── ProtectedRoute.tsx      # ✨ NEW: Route guard
    │   │   │   ├── OptionalAuthRoute.tsx   # ✨ NEW: Optional auth
    │   │   │   └── ErrorBoundary.tsx       # ✨ NEW: Error handling
    │   │   ├── pages/
    │   │   │   ├── Login.tsx               # ✨ NEW: Login page
    │   │   │   ├── Register.tsx            # ✨ NEW: Register page
    │   │   │   └── Profile.tsx             # ✨ NEW: Profile page
    │   │   └── App.tsx                     # ✅ Existing (add auth hooks)
    │   ├── .env                            # ✅ Existing (add auth vars)
    │   └── package.json                    # ✅ Existing
    │
    └── admin/               # Admin panel
        ├── src/
        │   ├── components/
        │   │   └── ProtectedRoute.tsx      # ✨ NEW: Route guard
        │   └── App.tsx                     # ✅ Existing (add auth hooks)
        ├── .env                            # ✅ Existing (add auth vars)
        └── package.json                    # ✅ Existing
```

### Build Order

After creating new files, build packages in this order:

```bash
# From monorepo root
cd /Users/muhammadusmannaeem/Data/projects/Upwork/George/resomix-web

# 1. Build api-client first (types + auth endpoints)
pnpm --filter @resomix/api-client build

# 2. Build stores (depends on api-client types)
pnpm --filter @resomix/stores build

# 3. Build hooks (depends on stores + api-client)
pnpm --filter @resomix/hooks build

# 4. Now apps can use everything
pnpm dev:webapp   # or pnpm dev:admin
```

### Key Integration Points

1. **Shared Types**: All auth types in `@resomix/api-client/types/auth.ts`
2. **Shared Store**: Single `useAuthStore` in `@resomix/stores` used by all apps
3. **Shared Hooks**: Auth hooks in `@resomix/hooks` for common functionality
4. **App-Specific**: Routes, pages, and UI components in individual apps

---

## Overview

ResomiX supports **optional authentication** - all core features work without login, but authenticated users get additional benefits:

- ✅ **Without Login:** Full access to similarity search, track search, playlist viewing
- 🔐 **With Login:** Profile management, playlist ownership, personalized history, session management

### Key Features

- JWT-based authentication (access + refresh tokens)
- Cross-subdomain session persistence
- Automatic token refresh
- Email verification flow
- Two-Factor Authentication (2FA) via email
- Password reset flow
- Session management (multi-device support)

---

## Authentication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Zustand    │  │  API Client  │  │    Axios     │      │
│  │    Store     │←→│  (Interceptor)│←→│  Instance    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ↕
                    [Cross-Subdomain Cookies]
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Rate Limiter │→ │ Auth Routes  │→ │   Services   │      │
│  │  Middleware  │  │ (JWT Verify) │  │ (Business)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup & Configuration

### 1. Environment Variables

**Location:** Update your existing `.env` files in each app:
- `apps/webapp/env.example` → Create `apps/webapp/.env`
- `apps/admin/env.example` → Create `apps/admin/.env`

Add the following auth-specific variables to your existing `.env` files:

```env
# Existing variables (keep these as-is)
VITE_BASE_LANDING_URL=https://resomix.com
VITE_BASE_BETA_URL=https://beta.resomix.com
VITE_SERVER_BACKEND=https://bserver.resomix.com
VITE_SERVER_MEDIA=https://media.resomix.com

# NEW: Authentication Configuration (add these)
VITE_API_BASE_URL=https://bserver.resomix.com
VITE_AUTH_DOMAIN=.resomix.com
VITE_ENABLE_2FA=true
VITE_ENABLE_EMAIL_VERIFICATION=true
```

### 2. Dependencies Check

**✅ Already installed in your monorepo:**
- `axios` - Already in `@resomix/api-client`
- `zustand` - Already in `@resomix/stores`
- `@types/node` - Already in root `devDependencies`

**No additional packages needed!** Your monorepo already has everything required.

### 3. TypeScript Types

**Location:** `packages/api-client/src/types/auth.ts` (new file)

> **Note:** Create this in the shared `@resomix/api-client` package so all apps can use the same types.

```typescript
// User Types
export interface User {
  id: number;
  uuid: string;
  email: string;
  username: string;
  name: string | null;
  email_verified: boolean;
  two_factor_enabled: boolean;
  two_factor_method: '2fa_email' | null;
  language: string | null;
  timezone: string | null;
  profile_picture: string | null;
  created_at: string;
  last_login: string | null;
}

// Authentication Responses
export interface LoginResponse {
  success: boolean;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user: User;
  };
}

export interface TwoFactorRequiredResponse {
  success: boolean;
  data: {
    requires_2fa: true;
    user_id: number;
    method: '2fa_email';
    message: string;
  };
}

export interface RegisterResponse {
  success: boolean;
  data: {
    user: User;
    message: string;
  };
}

export interface TokenRefreshResponse {
  success: boolean;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
}

// Request Types
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email_or_username: string;
  password: string;
}

export interface TwoFactorVerifyRequest {
  user_id: number;
  code: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// Session Types
export interface UserSession {
  session_id: string;
  device_name: string | null;
  ip_address: string | null;
  last_active: string;
  created_at: string;
  is_current: boolean;
}

// Error Response
export interface ErrorResponse {
  success: false;
  error: string;
}
```

---

## Zustand Store Implementation

**Location:** `packages/stores/src/useAuth.ts` (new file)

> **Note:** Create this in the shared `@resomix/stores` package to be used by all apps (webapp, admin, landing).

```typescript
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
        // Clear localStorage
        localStorage.removeItem('resomix_auth_token');
        localStorage.removeItem('resomix_refresh_token');
        localStorage.removeItem('resomix_user');
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

export { useAuthStore };
```

**Export from store index:** Add to `packages/stores/src/index.ts`:

```typescript
export { useAuthStore } from './useAuth';
export type { User } from '@resomix/api-client';
```

**Build the package:**

```bash
# From monorepo root
pnpm --filter @resomix/stores build
```

---

## API Client Setup

**Location:** Update existing `packages/api-client/src/utils.ts`

> **Note:** Your existing `axiosInstance` in `packages/api-client/src/utils.ts` already handles the base setup. We'll extend it with auth interceptors.

**Create a new auth-aware client:** `packages/api-client/src/authClient.ts`:

```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './config';

// Import will be added after useAuthStore is created
// For now, we'll use dynamic import to avoid circular dependencies
const getAuthStore = () => {
  try {
    // Dynamic import to access Zustand store from another package
    return (globalThis as any).__RESOMIX_AUTH_STORE__;
  } catch {
    return null;
  }
};

const API_BASE_URL = API_CONFIG.BASE_URL;
const API_TIMEOUT = 300_000; // 5 minutes (matches existing setup)

// Create axios instance
const apiClient: AxiosInstance = axios.create({
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
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - Add auth token
authClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = getAuthStore();
    if (!authStore) return config;

    const { accessToken, isTokenExpired } = authStore.getState();

    // Add authorization header if token exists and not expired
    if (accessToken && !isTokenExpired()) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Note: api_key is still added by the base axiosInstance interceptor
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

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      const authStore = getAuthStore();
      if (!authStore) return Promise.reject(error);

      const { refreshToken, setAccessToken, logout } = authStore.getState();

      // If no refresh token, logout
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
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
        // Attempt to refresh token
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { 
            withCredentials: true,
            params: { api_key: API_CONFIG.API_KEY } // Include api_key for auth endpoints
          }
        );

        if (response.data.success) {
          const newAccessToken = response.data.data.access_token;
          setAccessToken(newAccessToken);

          // Update authorization header
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          // Process queued requests
          processQueue(null, newAccessToken);

          isRefreshing = false;

          // Retry original request
          return authClient(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default authClient;
```

**Export from api-client index:** Add to `packages/api-client/src/index.ts`:

```typescript
export { default as authClient } from './authClient';
export { default as apiAxiosInstance } from './utils'; // Keep existing export
```

**Build the package:**

```bash
# From monorepo root
pnpm --filter @resomix/api-client build
```

---

## Authentication Endpoints

### Base URL
```
https://api.resomix.com/auth
```

---

### 1. **Register**

**Endpoint:** `POST /auth/register`

**Rate Limit:** 5 requests per minute per IP

**Payload:**
```typescript
{
  email: string;              // Required, valid email
  username: string;           // Required, 3-50 chars, alphanumeric + _ -
  password: string;           // Required, min 8 chars, strong password
  name?: string;              // Optional, display name
}
```

**Response (Success):**
```typescript
{
  success: true;
  data: {
    user: User;
    message: "Registration successful. Please check your email to verify your account.";
  }
}
```

**Response (Error):**
```typescript
{
  success: false;
  error: "Email already registered" | "Username already taken" | "Password too weak";
}
```

**Implementation:**

**Location:** Create `packages/api-client/src/auth/register.ts`:

```typescript
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { RegisterRequest, RegisterResponse } from '../types/auth';

export const register = async (data: RegisterRequest) => {
  try {
    const response = await axiosWrapper<RegisterResponse>(
      authClient.post('/auth/register', data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};
```

**Usage in app components** (e.g., `apps/webapp/src/pages/Register.tsx`):

```typescript
import { register } from '@resomix/api-client';
import type { RegisterRequest } from '@resomix/api-client';

const handleRegister = async (formData: RegisterRequest) => {
  try {
    const result = await register(formData);
    if (result.success) {
      // Show success message - check email for verification
      toast.success(result.data.message);
      navigate('/verify-email-sent');
    } else {
      toast.error(result.error || 'Registration failed');
    }
  } catch (error) {
    toast.error('Registration failed');
  }
};
```

---

### 2. **Login**

**Endpoint:** `POST /auth/login`

**Rate Limit:** 5 requests per minute per IP

**Payload:**
```typescript
{
  email_or_username: string;  // Required, email or username
  password: string;           // Required
}
```

**Response (Success - No 2FA):**
```typescript
{
  success: true;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: "bearer";
    expires_in: 900;  // 15 minutes in seconds
    user: User;
  }
}
```

**Response (Success - 2FA Required):**
```typescript
{
  success: true;
  data: {
    requires_2fa: true;
    user_id: number;
    method: "2fa_email";
    message: "Two-factor authentication code sent to your email";
  }
}
```

**Response (Error):**
```typescript
{
  success: false;
  error: "Invalid credentials" | "Email not verified" | "Account locked";
}
```

**Implementation:**

**Location:** Create `packages/api-client/src/auth/login.ts`:

```typescript
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { LoginRequest, LoginResponse, TwoFactorRequiredResponse } from '../types/auth';

export const login = async (data: LoginRequest) => {
  try {
    const response = await axiosWrapper<LoginResponse | TwoFactorRequiredResponse>(
      authClient.post('/auth/login', data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};
```

**Usage in app components** (e.g., `apps/webapp/src/pages/Login.tsx`):

```typescript
import { login } from '@resomix/api-client';
import { useAuthStore } from '@resomix/stores';
import type { LoginRequest } from '@resomix/api-client';

const handleLogin = async (formData: LoginRequest) => {
  try {
    const result = await login(formData);
    
    if (result.success && 'requires_2fa' in result.data && result.data.requires_2fa) {
      // Redirect to 2FA verification
      navigate('/verify-2fa', { state: { userId: result.data.user_id } });
    } else if (result.success && 'access_token' in result.data) {
      // Login successful
      const { setAuth } = useAuthStore.getState();
      setAuth(
        result.data.user,
        result.data.access_token,
        result.data.refresh_token
      );
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
  } catch (error) {
    toast.error('Login failed');
  }
};
```

---

### 3. **Verify 2FA Code**

**Endpoint:** `POST /auth/verify-2fa`

**Payload:**
```typescript
{
  user_id: number;  // From login response
  code: string;     // 6-digit code from email
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: "bearer";
    expires_in: 900;
    user: User;
  }
}
```

**Implementation:**

**Location:** `packages/api-client/src/auth/verify2FA.ts`:

```typescript
import authClient from '../authClient';
import { axiosWrapper, handleApiError } from '../utils';
import type { TwoFactorVerifyRequest, LoginResponse } from '../types/auth';

export const verify2FA = async (data: TwoFactorVerifyRequest) => {
  try {
    const response = await axiosWrapper<LoginResponse>(
      authClient.post('/auth/verify-2fa', data)
    );
    return response;
  } catch (error) {
    return handleApiError(error as any);
  }
};
```

---

### 4. **Verify Email**

**Endpoint:** `GET /auth/verify-email?token={token}`

**Query Parameters:**
- `token` (string, required): Verification token from email link

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Email verified successfully. Welcome!";
  }
}
```

**Implementation:**
```typescript
export const verifyEmail = async (token: string) => {
  const response = await apiClient.get(`/auth/verify-email?token=${token}`);
  return response.data;
};

// Usage in verification page
const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyEmail(token)
        .then(() => {
          toast.success('Email verified! You can now log in.');
          navigate('/login');
        })
        .catch(() => {
          toast.error('Verification failed or link expired');
        });
    }
  }, [token]);
};
```

---

### 5. **Resend Verification Email**

**Endpoint:** `POST /auth/resend-verification`

**Rate Limit:** 3 requests per minute per IP

**Payload:**
```typescript
{
  email: string;  // User's email address
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Verification email sent successfully";
  }
}
```

**Implementation:**
```typescript
export const resendVerification = async (email: string) => {
  const response = await apiClient.post('/auth/resend-verification', { email });
  return response.data;
};
```

---

### 6. **Request Password Reset**

**Endpoint:** `POST /auth/password-reset`

**Rate Limit:** 3 requests per minute per IP

**Payload:**
```typescript
{
  email: string;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    message: "If an account exists with this email, a password reset link has been sent";
  }
}
```

**Implementation:**
```typescript
export const requestPasswordReset = async (email: string) => {
  const response = await apiClient.post('/auth/password-reset', { email });
  return response.data;
};
```

---

### 7. **Confirm Password Reset**

**Endpoint:** `POST /auth/password-reset-confirm`

**Payload:**
```typescript
{
  token: string;        // From email link
  new_password: string; // Min 8 chars, strong password
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Password reset successful. You can now log in with your new password.";
  }
}
```

**Implementation:**
```typescript
export const confirmPasswordReset = async (token: string, newPassword: string) => {
  const response = await apiClient.post('/auth/password-reset-confirm', {
    token,
    new_password: newPassword,
  });
  return response.data;
};
```

---

### 8. **Refresh Access Token**

**Endpoint:** `POST /auth/refresh`

**Payload:**
```typescript
{
  refresh_token: string;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    access_token: string;
    token_type: "bearer";
    expires_in: 900;
  }
}
```

**Note:** This is handled automatically by the axios interceptor, but you can call it manually:

```typescript
export const refreshAccessToken = async (refreshToken: string) => {
  const response = await apiClient.post<TokenRefreshResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return response.data;
};
```

---

### 9. **Logout**

**Endpoint:** `POST /auth/logout`

**Headers:** `Authorization: Bearer {access_token}`

**Payload:**
```typescript
{
  refresh_token: string;
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Logged out successfully";
  }
}
```

**Implementation:**
```typescript
export const logout = async (refreshToken: string) => {
  const response = await apiClient.post('/auth/logout', {
    refresh_token: refreshToken,
  });
  return response.data;
};

// Usage
const handleLogout = async () => {
  const { refreshToken, logout: clearAuth } = useAuthStore.getState();
  
  try {
    if (refreshToken) {
      await logout(refreshToken);
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Always clear local state
    clearAuth();
    navigate('/');
  }
};
```

---

### 10. **Logout All Devices**

**Endpoint:** `POST /auth/logout-all`

**Headers:** `Authorization: Bearer {access_token}`

**Query Parameters:**
- `user_id` (number): From current user (should be obtained from token, but backend requires it)

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Logged out from all devices";
  }
}
```

---

## User Profile Endpoints

### Base URL
```
https://api.resomix.com/users
```

**All profile endpoints require authentication** (Authorization header).

---

### 1. **Get My Profile**

**Endpoint:** `GET /users/me`

**Headers:** `Authorization: Bearer {access_token}`

**Response:**
```typescript
{
  success: true;
  data: {
    user: User;
  }
}
```

**Implementation:**
```typescript
export const getMyProfile = async () => {
  const response = await apiClient.get('/users/me');
  return response.data;
};
```

---

### 2. **Update My Profile**

**Endpoint:** `PUT /users/me`

**Headers:** `Authorization: Bearer {access_token}`

**Payload (all optional):**
```typescript
{
  name?: string;
  language?: string;  // e.g., "en", "es", "fr"
  timezone?: string;  // e.g., "UTC", "America/New_York"
  profile_picture?: string;  // URL or base64
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    user: User;
    message: "Profile updated successfully";
  }
}
```

**Implementation:**
```typescript
export const updateProfile = async (updates: Partial<User>) => {
  const response = await apiClient.put('/users/me', updates);
  
  // Update Zustand store
  const { updateUser } = useAuthStore.getState();
  if (response.data.success) {
    updateUser(response.data.data.user);
  }
  
  return response.data;
};
```

---

### 3. **Change Password**

**Endpoint:** `POST /users/me/change-password`

**Headers:** `Authorization: Bearer {access_token}`

**Payload:**
```typescript
{
  current_password: string;
  new_password: string;  // Min 8 chars, strong
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Password changed successfully";
  }
}
```

**Implementation:**
```typescript
export const changePassword = async (data: ChangePasswordRequest) => {
  const response = await apiClient.post('/users/me/change-password', data);
  return response.data;
};
```

---

### 4. **Delete Account**

**Endpoint:** `DELETE /users/me`

**Headers:** `Authorization: Bearer {access_token}`

**Payload:**
```typescript
{
  password: string;  // For confirmation
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Account deleted successfully";
  }
}
```

---

### 5. **Get My Sessions**

**Endpoint:** `GET /users/me/sessions`

**Headers:** `Authorization: Bearer {access_token}`

**Response:**
```typescript
{
  success: true;
  data: {
    sessions: UserSession[];
  }
}
```

**Implementation:**
```typescript
export const getMySessions = async () => {
  const response = await apiClient.get('/users/me/sessions');
  return response.data;
};
```

---

### 6. **Revoke Session**

**Endpoint:** `DELETE /users/me/sessions/{session_id}`

**Headers:** `Authorization: Bearer {access_token}`

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Session revoked successfully";
  }
}
```

**Implementation:**
```typescript
export const revokeSession = async (sessionId: string) => {
  const response = await apiClient.delete(`/users/me/sessions/${sessionId}`);
  return response.data;
};
```

---

### 7. **Enable 2FA**

**Endpoint:** `POST /users/me/2fa/enable`

**Headers:** `Authorization: Bearer {access_token}`

**Payload:**
```typescript
{
  method: "2fa_email";  // Currently only email supported
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Two-factor authentication enabled successfully";
  }
}
```

---

### 8. **Disable 2FA**

**Endpoint:** `POST /users/me/2fa/disable`

**Headers:** `Authorization: Bearer {access_token}`

**Payload:**
```typescript
{
  password: string;  // For confirmation
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    message: "Two-factor authentication disabled successfully";
  }
}
```

---

## Optional Authentication Endpoints

These endpoints work **with or without** authentication. If authenticated, user-specific features are enabled.

---

### 1. **Similarity Search by Upload**

**Endpoint:** `POST /similarity/upload`

**Headers (Optional):** `Authorization: Bearer {access_token}`

**Content-Type:** `multipart/form-data`

**Payload:**
```typescript
{
  file: File;           // Audio file (max 50MB)
  top_sk?: number;      // Optional: 10, 20, 50, or 100 (default: 20)
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    queried_track: SimilarTrack;
    similar_tracks: SimilarTrack[];
    playlist: {
      id: string;        // Playlist UUID
      name: string;
    };
  }
}
```

**Behavior:**
- **Without Auth:** Playlist created with `user_id: null` (anonymous)
- **With Auth:** Playlist created with `user_id: {logged_in_user_id}` (user can view in "My Playlists")

**Implementation:**
```typescript
export const uploadSimilaritySearch = async (
  file: File,
  topSk?: number
) => {
  const formData = new FormData();
  formData.append('file', file);
  if (topSk) formData.append('top_sk', topSk.toString());

  const response = await apiClient.post('/similarity/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  
  return response.data;
};

// Usage
const handleUpload = async (audioFile: File) => {
  const { isAuthenticated } = useAuthStore.getState();
  
  try {
    const result = await uploadSimilaritySearch(audioFile, 20);
    
    if (result.success) {
      // Navigate to playlist
      navigate(`/playlist/${result.data.playlist.id}`);
      
      // Show appropriate message
      if (isAuthenticated) {
        toast.success('Playlist created and saved to your account!');
      } else {
        toast.success('Playlist created! Sign in to save it permanently.');
      }
    }
  } catch (error) {
    toast.error('Upload failed');
  }
};
```

---

### 2. **Similarity Search by Track ID**

**Endpoint:** `GET /similarity/{track_id}`

**Headers (Optional):** `Authorization: Bearer {access_token}`

**Query Parameters:**
- `top_sk` (number, optional): 10, 20, 50, or 100 (default: 20)

**Response:** Same as upload endpoint

**Behavior:** Same as upload - playlist associated with user if logged in

**Implementation:**
```typescript
export const getSimilarityById = async (trackId: string, topSk?: number) => {
  const params = topSk ? { top_sk: topSk } : {};
  const response = await apiClient.get(`/similarity/${trackId}`, { params });
  return response.data;
};
```

---

## Cross-Subdomain Authentication

### Problem
You have multiple subdomains:
- `app.resomix.com` (main app)
- `admin.resomix.com` (admin panel)
- `api.resomix.com` (backend)

Users should stay logged in across all subdomains.

### Solution

#### 1. **Backend Configuration (Already Done)**

The backend sets cookies with `domain=.resomix.com`:

```python
# This is already configured in your backend
response.set_cookie(
    key="session_token",
    value=refresh_token,
    domain=".resomix.com",  # Leading dot makes it work for all subdomains
    httponly=True,
    secure=True,  # HTTPS only
    samesite="lax"
)
```

#### 2. **Frontend Axios Configuration**

Already configured in `apiClient.ts`:

```typescript
const apiClient = axios.create({
  withCredentials: true,  // ✅ This sends cookies cross-origin
});
```

#### 3. **LocalStorage Sync (Optional but Recommended)**

For better UX, sync auth state across tabs/subdomains using `localStorage` events:

**Location:** `packages/hooks/src/Auth/useCrossTabAuth.ts` (new file):

```typescript
import { useEffect } from 'react';
import { useAuthStore } from '@resomix/stores';

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
              const { user, accessToken, refreshToken } = newState.state;
              if (user && accessToken && refreshToken) {
                setAuth(user, accessToken, refreshToken);
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

export { useCrossTabAuth };
```

**Export from hooks index:** Add to `packages/hooks/src/index.ts`:

```typescript
export { useCrossTabAuth } from './Auth/useCrossTabAuth';
```

**Usage in apps** (e.g., `apps/webapp/src/App.tsx` or `apps/admin/src/App.tsx`):

```typescript
import { useCrossTabAuth } from '@resomix/hooks';

function App() {
  useCrossTabAuth(); // Sync auth across tabs
  
  return <RouterProvider router={router} />;
}
```

---

## Error Handling

### 1. **API Error Handler**

> **Note:** Your existing `handleApiError` function in `packages/api-client/src/utils.ts` already provides this functionality! No need to create a new file.

**Existing implementation** in `packages/api-client/src/utils.ts`:

```typescript
import { AxiosError } from 'axios';
import type { ErrorResponse } from './types/auth';

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorResponse>;
    
    // Server responded with error
    if (axiosError.response) {
      return axiosError.response.data.error || 'An error occurred';
    }
    
    // Network error
    if (axiosError.request) {
      return 'Network error. Please check your connection.';
    }
  }
  
  return 'An unexpected error occurred';
};

// Usage in app components
import { handleApiError } from '@resomix/api-client';

try {
  await login(formData);
} catch (error) {
  const errorMessage = handleApiError(error);
  toast.error(errorMessage);
}
```

### 2. **Error Boundary Component**

**Location:** Create in individual apps as needed (e.g., `apps/webapp/src/components/ErrorBoundary.tsx` or `apps/admin/src/components/ErrorBoundary.tsx`):

> **Note:** Error boundaries are React components and are better kept in individual apps rather than the shared `@resomix/ui` package, as each app may need different error handling UI.

```typescript
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

## Best Practices

### 1. **Token Management**

```typescript
// ✅ DO: Check token before sensitive operations
const { isAuthenticated, isTokenExpired } = useAuthStore.getState();
if (isAuthenticated && !isTokenExpired()) {
  // Safe to make authenticated requests
}

// ❌ DON'T: Store tokens in plain localStorage without encryption
// (Zustand persist with JSON storage is acceptable for this use case)
```

### 2. **Protected Routes**

**Location:** Create in individual apps as needed:
- `apps/webapp/src/components/ProtectedRoute.tsx`
- `apps/admin/src/components/ProtectedRoute.tsx`

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@resomix/stores';

export const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    // Redirect to login with return URL
    return <Navigate to="/login" state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

// Usage in router
const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/profile', element: <ProfilePage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
]);
```

### 3. **Optional Auth Routes**

**Location:** Create in individual apps where needed (e.g., `apps/webapp/src/components/OptionalAuthRoute.tsx`):

```typescript
import { ReactNode } from 'react';
import { useAuthStore } from '@resomix/stores';

export const OptionalAuthRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  // Render with or without auth
  return (
    <div data-authenticated={isAuthenticated}>
      {children}
    </div>
  );
};

// Usage
<OptionalAuthRoute>
  <SimilaritySearchPage />
</OptionalAuthRoute>
```

### 4. **Auth State Initialization**

**Location:** `packages/hooks/src/Auth/useAuthInit.ts` (new file):

```typescript
import { useEffect } from 'react';
import { useAuthStore } from '@resomix/stores';
import { getMyProfile } from '@resomix/api-client';

export const useAuthInit = () => {
  const { isAuthenticated, setUser, logout } = useAuthStore();

  useEffect(() => {
    // Verify token and refresh user data on app load
    if (isAuthenticated) {
      getMyProfile()
        .then((response) => {
          if (response.success) {
            setUser(response.data.user);
          }
        })
        .catch(() => {
          // Token invalid, logout
          logout();
        });
    }
  }, []);
};

export { useAuthInit };
```

**Export from hooks index:** Add to `packages/hooks/src/index.ts`:

```typescript
export { useAuthInit } from './Auth/useAuthInit';
export { useCrossTabAuth } from './Auth/useCrossTabAuth';
```

**Usage in apps** (e.g., `apps/webapp/src/App.tsx`):

```typescript
import { useAuthInit, useCrossTabAuth } from '@resomix/hooks';

function App() {
  useAuthInit();      // Verify and refresh auth on load
  useCrossTabAuth();  // Sync auth across tabs
  
  return <RouterProvider router={router} />;
}
```

### 5. **Rate Limiting Feedback**

**Location:** Add this interceptor to `packages/api-client/src/authClient.ts` (in the existing response interceptor):

```typescript
// Add to existing response interceptor in authClient.ts
authClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn(`Rate limited. Retry after: ${retryAfter || '60'} seconds`);
      // Apps can listen for this and show toast notifications
    }

    // ... existing 401 handling code ...
    
    return Promise.reject(error);
  }
);
```

**Usage in apps** (show toast notifications):

```typescript
// In apps/webapp/src/App.tsx or apps/admin/src/App.tsx
import { authClient } from '@resomix/api-client';

// Add global error interceptor for toast notifications
authClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      toast.error(`Too many requests. Please try again in ${retryAfter || '60'} seconds.`);
    }
    return Promise.reject(error);
  }
);
```

### 6. **Email Verification Prompt**

**Location:** Create in apps where needed (e.g., `apps/webapp/src/components/EmailVerificationBanner.tsx`):

```typescript
import { useState } from 'react';
import { useAuthStore } from '@resomix/stores';
import { resendVerification } from '@resomix/api-client';

const EmailVerificationBanner = () => {
  const { user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.email_verified || dismissed) return null;

  return (
    <div className="verification-banner">
      <p>Please verify your email to access all features.</p>
      <button onClick={() => resendVerification(user.email)}>
        Resend Email
      </button>
      <button onClick={() => setDismissed(true)}>Dismiss</button>
    </div>
  );
};
```

### 7. **Session Timeout Warning**

**Location:** `packages/hooks/src/Auth/useSessionTimeout.ts` (new file):

```typescript
import { useEffect, useState } from 'react';
import { useAuthStore } from '@resomix/stores';
import { refreshAccessToken } from '@resomix/api-client';

export const useSessionTimeout = () => {
  const { accessToken, refreshToken, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    // Check token expiration
    const checkExpiration = () => {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const exp = payload.exp * 1000;
        const now = Date.now();
        const timeLeft = exp - now;

        // Show warning 2 minutes before expiration
        if (timeLeft < 120000 && timeLeft > 0) {
          setShowWarning(true);
        }
      } catch (error) {
        console.error('Token parsing error:', error);
      }
    };

    const interval = setInterval(checkExpiration, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [accessToken]);

  const extendSession = async () => {
    try {
      await refreshAccessToken(refreshToken!);
      setShowWarning(false);
    } catch (error) {
      logout();
    }
  };

  return { showWarning, extendSession };
};

export { useSessionTimeout };
```

**Export from hooks index:** Add to `packages/hooks/src/index.ts`:

```typescript
export { useSessionTimeout } from './Auth/useSessionTimeout';
```

### 8. **Conditional UI Based on Auth**

**Location:** Example in apps (e.g., `apps/webapp/src/components/NavigationBar.tsx`):

```typescript
import { useAuthStore } from '@resomix/stores';

const NavigationBar = () => {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/search">Search</Link>
      
      {isAuthenticated ? (
        <>
          <Link to="/profile">
            {user?.name || user?.username}
          </Link>
          <button onClick={handleLogout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/register">Sign Up</Link>
        </>
      )}
    </nav>
  );
};
```

---

## Complete API Reference

### Authentication Endpoints

| Endpoint | Method | Auth Required | Rate Limited | Purpose |
|----------|--------|---------------|--------------|---------|
| `/auth/register` | POST | ❌ | ✅ 5/min | Register new user |
| `/auth/login` | POST | ❌ | ✅ 5/min | Login user |
| `/auth/verify-2fa` | POST | ❌ | ❌ | Verify 2FA code |
| `/auth/verify-email` | GET | ❌ | ❌ | Verify email token |
| `/auth/resend-verification` | POST | ❌ | ✅ 3/min | Resend verification |
| `/auth/password-reset` | POST | ❌ | ✅ 3/min | Request reset |
| `/auth/password-reset-confirm` | POST | ❌ | ❌ | Confirm reset |
| `/auth/refresh` | POST | ❌ | ❌ | Refresh token |
| `/auth/logout` | POST | ✅ | ❌ | Logout current |
| `/auth/logout-all` | POST | ✅ | ❌ | Logout all devices |

### User Profile Endpoints

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/users/me` | GET | ✅ | Get profile |
| `/users/me` | PUT | ✅ | Update profile |
| `/users/me` | DELETE | ✅ | Delete account |
| `/users/me/change-password` | POST | ✅ | Change password |
| `/users/me/sessions` | GET | ✅ | List sessions |
| `/users/me/sessions/{id}` | DELETE | ✅ | Revoke session |
| `/users/me/2fa/enable` | POST | ✅ | Enable 2FA |
| `/users/me/2fa/disable` | POST | ✅ | Disable 2FA |

### Optional Auth Endpoints

| Endpoint | Method | Auth Required | Behavior |
|----------|--------|---------------|----------|
| `/similarity/upload` | POST | 🔓 Optional | Creates anonymous or user playlist |
| `/similarity/{track_id}` | GET | 🔓 Optional | Creates anonymous or user playlist |

---

## Testing Checklist

```typescript
// ✅ Authentication Flow
- [ ] Register new account
- [ ] Verify email
- [ ] Login without 2FA
- [ ] Login with 2FA
- [ ] Token auto-refresh on 401
- [ ] Logout single device
- [ ] Logout all devices

// ✅ Profile Management
- [ ] View profile
- [ ] Update profile fields
- [ ] Change password
- [ ] Enable/disable 2FA
- [ ] View active sessions
- [ ] Revoke sessions
- [ ] Delete account

// ✅ Error Handling
- [ ] Invalid credentials
- [ ] Expired tokens
- [ ] Network errors
- [ ] Rate limiting (429)
- [ ] Email not verified (403)

// ✅ Cross-Subdomain
- [ ] Login on app.resomix.com
- [ ] Navigate to admin.resomix.com (still authenticated)
- [ ] Logout on admin (reflected on app)

// ✅ Optional Auth
- [ ] Use similarity search without login
- [ ] Login and use similarity search (playlist saved)
- [ ] Logout and use similarity search (anonymous again)
```

---

## Security Considerations

1. **Never log sensitive data**
```typescript
// ❌ DON'T
console.log('Password:', password);
console.log('Token:', accessToken);

// ✅ DO
console.log('Login attempt for user:', username);
```

2. **Always use HTTPS in production**
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    https: true, // Development
  },
});
```

3. **Implement CSRF protection** (if using cookies for auth)
```typescript
// Backend already handles this with JWT
// No additional frontend work needed
```

4. **Sanitize user inputs**
```typescript
import DOMPurify from 'dompurify';

const sanitizedName = DOMPurify.sanitize(userInput);
```

5. **Use Content Security Policy**
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

---

## Troubleshooting

### Issue: "401 Unauthorized" after login

**Solution:** Check that the Authorization header is being sent:
```typescript
console.log('Auth header:', apiClient.defaults.headers.common.Authorization);
```

### Issue: Token refresh loop

**Solution:** Ensure `_retry` flag prevents infinite loops:
```typescript
if (error.response?.status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  // ... refresh logic
}
```

### Issue: Cross-subdomain auth not working

**Solution:**
1. Check cookie domain: `.resomix.com` (with leading dot)
2. Ensure `withCredentials: true` in axios
3. Verify backend CORS allows credentials

### Issue: Rate limiting blocking legitimate users

**Solution:** Implement exponential backoff:
```typescript
const retryWithBackoff = async (fn: () => Promise<any>, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
    }
  }
};
```

---

## Conclusion

This guide covers all aspects of integrating ResomiX authentication into your React frontend. Key takeaways:

1. ✅ **Zustand Store** manages auth state with persistence
2. ✅ **Axios Interceptors** handle token refresh automatically
3. ✅ **Cross-Subdomain** authentication works via cookies + localStorage sync
4. ✅ **Optional Auth** allows full functionality without login
5. ✅ **Rate Limiting** protects backend with user-friendly feedback
6. ✅ **2FA** and **Email Verification** enhance security

For additional help, refer to:
- Backend: `AUTH_IMPLEMENTATION_GUIDE.md`
- API Docs: `https://api.resomix.com/docs`

---

## 🚀 Quick Start Checklist

### Phase 1: Setup Shared Packages (Do Once)

```bash
# From monorepo root
cd /Users/muhammadusmannaeem/Data/projects/Upwork/George/resomix-web
```

**1. Create Auth Types** (`packages/api-client/src/types/auth.ts`)
- [ ] Copy types from section "TypeScript Types"
- [ ] Export from `packages/api-client/src/index.ts`

**2. Create Auth Store** (`packages/stores/src/useAuth.ts`)
- [ ] Copy Zustand store from section "Zustand Store Implementation"
- [ ] Export from `packages/stores/src/index.ts`

**3. Create Auth Client** (`packages/api-client/src/authClient.ts`)
- [ ] Copy authClient setup from section "API Client Setup"
- [ ] Export from `packages/api-client/src/index.ts`

**4. Create Auth API Functions** (`packages/api-client/src/auth/`)
- [ ] `login.ts` - Login endpoint
- [ ] `register.ts` - Register endpoint
- [ ] `verify2FA.ts` - 2FA verification
- [ ] `verifyEmail.ts` - Email verification
- [ ] `passwordReset.ts` - Password reset
- [ ] `logout.ts` - Logout
- [ ] `profile.ts` - Profile management
- [ ] Export all from `packages/api-client/src/index.ts`

**5. Create Auth Hooks** (`packages/hooks/src/Auth/`)
- [ ] `useCrossTabAuth.ts` - Cross-tab sync
- [ ] `useAuthInit.ts` - Auth initialization
- [ ] `useSessionTimeout.ts` - Session warnings
- [ ] Export from `packages/hooks/src/index.ts`

**6. Build Packages**
```bash
pnpm --filter @resomix/api-client build
pnpm --filter @resomix/stores build
pnpm --filter @resomix/hooks build
```

### Phase 2: Integrate in Webapp

**1. Update Environment** (`apps/webapp/.env`)
```env
VITE_API_BASE_URL=https://bserver.resomix.com
VITE_AUTH_DOMAIN=.resomix.com
VITE_ENABLE_2FA=true
VITE_ENABLE_EMAIL_VERIFICATION=true
```

**2. Create Components** (`apps/webapp/src/components/`)
- [ ] `ProtectedRoute.tsx`
- [ ] `OptionalAuthRoute.tsx`
- [ ] `ErrorBoundary.tsx`
- [ ] `EmailVerificationBanner.tsx`

**3. Create Auth Pages** (`apps/webapp/src/pages/`)
- [ ] `Login.tsx`
- [ ] `Register.tsx`
- [ ] `Profile.tsx`
- [ ] `VerifyEmail.tsx`
- [ ] `ResetPassword.tsx`

**4. Update App.tsx** (`apps/webapp/src/App.tsx`)
```typescript
import { useAuthInit, useCrossTabAuth } from '@resomix/hooks';

function App() {
  useAuthInit();       // Initialize auth
  useCrossTabAuth();   // Sync across tabs
  
  return <RouterProvider router={router} />;
}
```

**5. Update Router** (add protected routes)
- [ ] Wrap protected routes with `<ProtectedRoute />`
- [ ] Add auth routes (login, register, profile, etc.)

### Phase 3: Integrate in Admin Panel

**1. Update Environment** (`apps/admin/.env`)
```env
VITE_API_BASE_URL=https://bserver.resomix.com
VITE_AUTH_DOMAIN=.resomix.com
```

**2. Create Components** (`apps/admin/src/components/`)
- [ ] `ProtectedRoute.tsx`
- [ ] `ErrorBoundary.tsx`

**3. Update App.tsx** (`apps/admin/src/App.tsx`)
```typescript
import { useAuthInit, useCrossTabAuth } from '@resomix/hooks';

function App() {
  useAuthInit();
  useCrossTabAuth();
  
  return <RouterProvider router={router} />;
}
```

**4. Protect All Routes** (admin requires authentication)
- [ ] Wrap all routes with `<ProtectedRoute />`
- [ ] Redirect to webapp login if not authenticated

### Phase 4: Testing

- [ ] Register new account (webapp)
- [ ] Verify email
- [ ] Login (webapp)
- [ ] Check cross-tab sync (open another tab)
- [ ] Login to admin panel (should share session)
- [ ] Test token refresh (wait 15 minutes)
- [ ] Logout (verify both apps logout)
- [ ] Test optional features without login (similarity search)

### Phase 5: Production Checklist

- [ ] Update all `.env` files with production URLs
- [ ] Enable HTTPS for all domains
- [ ] Configure CORS on backend for `.resomix.com`
- [ ] Test cross-subdomain cookies in production
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Test on mobile devices (iOS, Android)
- [ ] Enable 2FA for admin accounts
- [ ] Review rate limiting configuration

---
