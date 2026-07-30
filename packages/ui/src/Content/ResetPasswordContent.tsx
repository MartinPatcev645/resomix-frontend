import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { StatusMessage } from "../Elements/StatusMessage";
import { PasswordInput } from "../Elements/PasswordInput";
import { AuthScreen } from "./AuthScreen";
import { AuthDone } from "./AuthDone";
import { PasswordRequirements } from "./PasswordRequirements";
import { PAGE_BTN_PRIMARY as BTN_PRIMARY } from "./pageChrome";

/**
 * Password reset (from an emailed token), on the shared AuthScreen shell.
 *
 * Two states: the invalid/expired-token dead end, and the form. Reset logic is unchanged; the
 * submit is now a real `type="submit"` rather than a ButtonSleek, so Enter works.
 */

interface ResetPasswordContentProps {
  baseUrl?: string;
  token?: string;
  onSuccess?: () => void;
  onNavigateLogin?: () => void;
  onNavigateForgotPassword?: () => void;
}

export default function ResetPasswordContent({
  baseUrl = "https://resomix.com",
  token: propToken,
  onSuccess,
  onNavigateLogin,
  onNavigateForgotPassword,
}: ResetPasswordContentProps) {
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong">("weak");
  const [token, setToken] = useState(propToken || "");
  const [tokenValid, setTokenValid] = useState(true);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTitle, setStatusTitle] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Password strength calculation
  const calculatePasswordStrength = (password: string): "weak" | "medium" | "strong" => {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

    if (strength <= 2) return "weak";
    if (strength <= 4) return "medium";
    return "strong";
  };

  // Password requirements (only enforce minimum requirements)
  const passwordRequirements = [
    { label: "At least 8 characters", met: form.password.length >= 8 },
    { label: "Contains at least one digit", met: /\d/.test(form.password) },
  ];

  // Check if token is provided (from URL or props)
  useEffect(() => {
    if (!propToken) {
      // Try to get token from URL if not provided as prop
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get("token");
      
      if (urlToken) {
        setToken(urlToken);
      } else {
        setTokenValid(false);
      }
    }
  }, [propToken]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    // Update password strength
    if (name === "password") {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    // Password validation
    if (!form.password) {
      newErrors.password = "Password is required";
    } else if (form.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/\d/.test(form.password)) {
      newErrors.password = "Password must contain at least one digit";
    }

    // Confirm password validation
    if (!form.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!validate() || !token) return;

    setSubmitting(true);
    setStatusType("loading");
    setStatusTitle(undefined);
    setStatusMessage("");
    setShowStatus(true);

    try {
      // Import dynamically to avoid circular dependencies
      const { confirmPasswordReset } = await import("@resomix/api-client");

      const result = await confirmPasswordReset(token, form.password);

      if (result.success) {
        setStatusType("success");
        setStatusTitle("Password reset");
        setStatusMessage("Password reset successfully! Redirecting to login...");

        // Clear form
        setForm({ password: "", confirmPassword: "" });

        // Redirect to login after delay
        setTimeout(() => {
          onSuccess?.();
          onNavigateLogin?.();
        }, 2000);
      } else {
        const errorResult = result as { success: false; error: string; status?: number };
        const message =
          errorResult.error || "Reset link expired or invalid. Please request a new one.";
        setStatusType("error");
        setStatusMessage(message);

        const lowerMessage = message.toLowerCase();
        if (errorResult.status === 429 || lowerMessage.includes("rate limit")) {
          setStatusTitle("Too many attempts");
        } else {
          setStatusTitle("Unable to reset password");
        setTokenValid(false);
        }
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setStatusType("error");
      setStatusTitle("Network error");
      setStatusMessage("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // If token is invalid, show error state
  if (!tokenValid) {
    return (
      <AuthScreen
        eyebrow="Account // Reset"
        title="Invalid Reset Link"
        backUrl={baseUrl}
        panelLabel="Link expired"
      >
        <AuthDone
          tone="error"
          message="This password reset link is invalid or has expired. Please request a new password reset link."
          actions={
            <button
              type="button"
              onClick={() => onNavigateForgotPassword?.()}
              className={`${BTN_PRIMARY} !min-h-[var(--px-44)] !px-[var(--px-22)]`}
            >
              Request New Reset Link
            </button>
          }
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      eyebrow="Account // Reset"
      title="Reset Password"
      lead="Enter your new password below."
      backUrl={baseUrl}
      panelLabel="New password"
    >
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[var(--px-18)] p-[var(--px-20)]">
        <div>
          <PasswordInput
            label="New Password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a strong password"
            required
            autoFocus
            autoComplete="new-password"
            error={errors.password}
            showStrength={true}
            strength={passwordStrength}
          />
          {form.password && <PasswordRequirements requirements={passwordRequirements} />}
        </div>

        <PasswordInput
          label="Confirm New Password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Re-enter your new password"
          required
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

        <button
          type="submit"
          disabled={submitting}
          className={`${BTN_PRIMARY} w-full !min-h-[var(--px-44)] !px-[var(--px-22)]`}
        >
          {submitting ? "Resetting Password..." : "Reset Password"}
        </button>
      </form>

      <StatusMessage
        isOpen={showStatus}
        onClose={() => setShowStatus(false)}
        status={statusType}
        title={statusTitle}
        message={statusMessage}
      />
    </AuthScreen>
  );
}

