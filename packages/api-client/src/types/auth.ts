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

// Profile Update Types
export interface ProfileUpdateRequest {
  name?: string;
  language?: string;
  timezone?: string;
  profile_picture?: string;
}

export interface ProfileResponse {
  success: boolean;
  data: {
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
  method: '2fa_email';
}

export interface Disable2FARequest {
  password: string;
}

// Delete Account Request
export interface DeleteAccountRequest {
  password: string;
}

