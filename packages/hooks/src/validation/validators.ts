/**
 * Validation Rules and Utilities
 * Centralized validation logic for form fields
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Email validation
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, error: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Please enter a valid email address" };
  }

  return { isValid: true };
};

/**
 * Password validation
 * Requirements: At least 8 characters and contains at least one digit
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, error: "Password is required" };
  }

  if (password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters long" };
  }

  if (!/\d/.test(password)) {
    return { isValid: false, error: "Password must contain at least one digit" };
  }

  return { isValid: true };
};

/**
 * Password strength calculation
 */
export const calculatePasswordStrength = (password: string): "weak" | "medium" | "strong" => {
  if (!password || password.length < 8) return "weak";

  let strength = 0;

  // Length
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;

  // Contains digit
  if (/\d/.test(password)) strength += 1;

  // Contains lowercase
  if (/[a-z]/.test(password)) strength += 1;

  // Contains uppercase
  if (/[A-Z]/.test(password)) strength += 1;

  // Contains special character
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 1;

  if (strength <= 2) return "weak";
  if (strength <= 4) return "medium";
  return "strong";
};

/**
 * Password confirmation validation
 */
export const validatePasswordConfirmation = (
  password: string,
  confirmation: string
): ValidationResult => {
  if (!confirmation) {
    return { isValid: false, error: "Please confirm your password" };
  }

  if (password !== confirmation) {
    return { isValid: false, error: "Passwords do not match" };
  }

  return { isValid: true };
};

/**
 * Username validation
 */
export const validateUsername = (username: string): ValidationResult => {
  if (!username) {
    return { isValid: false, error: "Username is required" };
  }

  if (username.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters long" };
  }

  if (username.length > 30) {
    return { isValid: false, error: "Username must be less than 30 characters" };
  }

  // Only alphanumeric, underscore, and hyphen allowed
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { isValid: false, error: "Username can only contain letters, numbers, hyphens, and underscores" };
  }

  return { isValid: true };
};

/**
 * Name validation (optional field)
 */
export const validateName = (name: string, required: boolean = false): ValidationResult => {
  if (!name) {
    if (required) {
      return { isValid: false, error: "Name is required" };
    }
    return { isValid: true };
  }

  if (name.length > 100) {
    return { isValid: false, error: "Name must be less than 100 characters" };
  }

  return { isValid: true };
};

/**
 * 2FA Code validation
 */
export const validate2FACode = (code: string): ValidationResult => {
  if (!code) {
    return { isValid: false, error: "Code is required" };
  }

  if (code.length !== 6) {
    return { isValid: false, error: "Code must be 6 digits" };
  }

  if (!/^\d{6}$/.test(code)) {
    return { isValid: false, error: "Code must contain only numbers" };
  }

  return { isValid: true };
};

/**
 * Required field validation
 */
export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || value.trim() === "") {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
};

/**
 * Checkbox validation (for terms, privacy, etc.)
 */
export const validateCheckbox = (
  checked: boolean,
  errorMessage: string = "You must accept to continue"
): ValidationResult => {
  if (!checked) {
    return { isValid: false, error: errorMessage };
  }

  return { isValid: true };
};

