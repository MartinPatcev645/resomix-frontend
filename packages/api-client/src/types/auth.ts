// User Types
export interface User {
  id?: number; // Optional - only available in some contexts
  uuid: string;
  email: string;
  username: string;
  name: string | null;
  is_email_verified: boolean;
  is_two_factor_enabled: boolean;
  two_factor_method: 'email' | null;
  language: string | null;
  timezone: string | null;
  profile_picture: string | null;
  /** False for social-login (e.g. Google) accounts that haven't set a local password yet. */
  has_password?: boolean;
  /** Linked OAuth providers, e.g. ["google"]. Empty/absent when only email+password. */
  auth_providers?: string[];
  created_at: string;
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
    message: string;
  };
}

/**
 * Registration does not return a `User`: the account is not usable until the emailed link is
 * clicked, so the server sends back only the identity fields (see `RegisterResponse` in the
 * backend's app/schemas/auth.py and the payload built in auth_controller.register).
 */
export interface RegisterResponse {
  success: boolean;
  data: {
    /** The backend's external user uuid, the same value `user.uuid` carries after login. */
    user_uuid: string;
    email: string;
    username: string;
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
  password: string;
  /**
   * Optional. The sign-up form only collects email + password; when this is omitted the server
   * derives the username from the email's local part and resolves collisions by appending "1"
   * (usman.naeem2212 → usman.naeem22121 → …). Only pass it where a username is genuinely chosen.
   */
  username?: string;
  name?: string;
}

export interface LoginRequest {
  email_or_username: string;
  password: string;
}

export interface AdminLoginRequest {
  email: string;
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

export interface VerifyEmailResponse {
  success: boolean;
  data: {
    message: string;
    email: string;
  };
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// Session Types
export interface UserSession {
  session_id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
}

// Error Response
export interface ErrorResponse {
  success: false;
  error: string;
  status?: number;
}

// Profile Update Types
export interface ProfileUpdateRequest {
  name?: string;
  language?: string;
  timezone?: string;
  profile_picture?: string;
}

export interface ProfileResponse {
  success: boolean;
  data: User | {
    user: User;
    message?: string;
  };
}

// Session Response Types
export interface SessionsResponse {
  success: boolean;
  data: {
    sessions: UserSession[];
  };
}

// Generic Success Response
export interface SuccessResponse {
  success: boolean;
  data: {
    message: string;
  };
}

// 2FA Types
export interface Enable2FARequest {
  method: 'email' | 'app';
}

export interface Enable2FAResponse {
  success: boolean;
  data: {
    message: string;
    is_two_factor_enabled: boolean;
    two_factor_method: string;
  };
}

export interface Disable2FAResponse {
  success: boolean;
  data: {
    message: string;
    is_two_factor_enabled: boolean;
  };
}

export interface Disable2FARequest {
  password: string;
}

// Delete Account Request
export interface DeleteAccountRequest {
  /** Omitted for social-login-only accounts, which have no password to confirm with. */
  password?: string;
}

