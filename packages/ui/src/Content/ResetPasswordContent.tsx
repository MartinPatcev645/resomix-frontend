import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { PasswordInput } from "../Elements/PasswordInput";

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

  // Password requirements
  const passwordRequirements = [
    { label: "At least 8 characters", met: form.password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(form.password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(form.password) },
    { label: "Contains number", met: /[0-9]/.test(form.password) },
    { label: "Contains special character", met: /[!@#$%^&*(),.?":{}|<>]/.test(form.password) },
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
    } else if (passwordStrength === "weak") {
      newErrors.password = "Password is too weak. Please meet more requirements.";
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
    setShowStatus(true);

    try {
      // Import dynamically to avoid circular dependencies
      const { confirmPasswordReset } = await import("@resomix/api-client");

      const result = await confirmPasswordReset(token, form.password);

      if (result.success) {
        setStatusType("success");
        setStatusMessage("Password reset successfully! Redirecting to login...");

        // Clear form
        setForm({ password: "", confirmPassword: "" });

        // Redirect to login after delay
        setTimeout(() => {
          onSuccess?.();
          onNavigateLogin?.();
        }, 2000);
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(
          errorResult.error || "Reset link expired or invalid. Please request a new one."
        );
        setTokenValid(false);
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // If token is invalid, show error state
  if (!tokenValid) {
    return (
      <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <header className="mb-[var(--px-28)] text-center">
            <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
              Invalid Reset Link
            </h1>
          </header>

          <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
            <div className="flex flex-col items-center gap-[var(--px-20)] text-center">
              <div className="text-[length:var(--px-60)] text-red-500">✕</div>
              <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica">
                This password reset link is invalid or has expired. Please request a new password
                reset link.
              </p>
              <div className="mt-[var(--px-10)]">
                <ButtonSleek
                  text="Request New Reset Link"
                  onClick={() => onNavigateForgotPassword?.()}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Reset Password
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Enter your new password below
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
          <div className="mb-[var(--px-24)]">
            <a
              href={baseUrl}
              aria-label="Resomix home"
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors"
            >
              ← Back to Home
            </a>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col w-full gap-[var(--px-20)]">
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

            {form.password && (
              <div className="flex flex-col gap-[var(--px-8)] -mt-[var(--px-10)]">
                <div className="text-[length:var(--px-10)] font-extralight font-helvetica">
                  Password requirements:
                </div>
                {passwordRequirements.map((req, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica"
                  >
                    <span className={req.met ? "text-green-500" : "text-gray-400"}>
                      {req.met ? "✓" : "○"}
                    </span>
                    <span className={req.met ? "text-green-500" : "text-gray-400"}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

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

            <div className="mt-[var(--px-10)]">
              <ButtonSleek
                text={submitting ? "Resetting Password..." : "Reset Password"}
                onClick={handleSubmit}
              />
            </div>
          </form>

          <StatusMessage
            isOpen={showStatus}
            onClose={() => setShowStatus(false)}
            status={statusType}
            message={statusMessage}
          />
        </div>
      </div>
    </section>
  );
}

