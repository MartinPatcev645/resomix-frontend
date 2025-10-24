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
    two_factor_required: true;
    user_id: number;
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
  data: UserSession[];
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
  password: string;
}

