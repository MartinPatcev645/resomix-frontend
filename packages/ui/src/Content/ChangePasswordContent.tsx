import { useState, FormEvent, ChangeEvent } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { PasswordInput } from "../Elements/PasswordInput";
import { useAuthStore } from "@resomix/stores";

interface ChangePasswordContentProps {
  baseUrl?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ChangePasswordContent({
  baseUrl = "https://resomix.com",
  onSuccess,
  onCancel,
}: ChangePasswordContentProps) {
  // Social-login (e.g. Google) accounts have no password yet — this screen then becomes "Set
  // password" (no current-password field). `undefined` (older sessions) is treated as "has password".
  const hasPassword = useAuthStore((s) => s.user?.has_password) !== false;
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong">("weak");

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

  // Password requirements (only enforce minimum requirements)
  const passwordRequirements = [
    { label: "At least 8 characters", met: form.newPassword.length >= 8 },
    { label: "Contains at least one digit", met: /\d/.test(form.newPassword) },
  ];

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    // Update password strength
    if (name === "newPassword") {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    // Current password validation (only when the account already has one)
    if (hasPassword && !form.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    // New password validation
    if (!form.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (form.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    } else if (!/\d/.test(form.newPassword)) {
      newErrors.newPassword = "Password must contain at least one digit";
    } else if (hasPassword && form.newPassword === form.currentPassword) {
      newErrors.newPassword = "New password must be different from current password";
    }

    // Confirm password validation
    if (!form.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (form.newPassword !== form.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage(hasPassword ? "Changing password..." : "Setting password...");

    try {
      const { changePassword } = await import("@resomix/api-client");

      const result = await changePassword({
        current_password: hasPassword ? form.currentPassword : "",
        new_password: form.newPassword,
      });

      if (result.success) {
        // Reflect that the account now has a local password (enables password login going forward).
        try {
          const currentUser = useAuthStore.getState().user;
          if (currentUser) useAuthStore.getState().setUser({ ...currentUser, has_password: true });
        } catch { /* noop */ }
        setStatusType("success");
        setStatusMessage(hasPassword ? "Password changed successfully!" : "Password set successfully!");

        // Clear form
        setForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        // Call success callback after delay
        setTimeout(() => {
          onSuccess?.();
        }, 2000);
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Current password is incorrect");
      }
    } catch (error) {
      console.error("Change password error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-3)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            {hasPassword ? "Change Password" : "Set Password"}
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            {hasPassword
              ? "Update your account password"
              : "Add a password so you can also sign in with email — your Google sign-in keeps working"}
          </p>
        </header>

        <div className="max-w-[var(--px-550)] p-[var(--px-20)] w-full">
          <div className="mb-[var(--px-24)]">
            <button
              onClick={onCancel}
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors"
            >
              ← Back to Profile
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col w-full gap-[var(--px-20)]">
            {hasPassword && (
              <PasswordInput
                label="Current Password"
                name="currentPassword"
                value={form.currentPassword}
                onChange={handleChange}
                placeholder="Enter your current password"
                required
                autoFocus
                autoComplete="current-password"
                error={errors.currentPassword}
              />
            )}

            <PasswordInput
              label="New Password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="Create a strong password"
              required
              autoFocus={!hasPassword}
              autoComplete="new-password"
              error={errors.newPassword}
              showStrength={true}
              strength={passwordStrength}
            />

            {form.newPassword && (
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

            <div className="flex gap-[var(--px-10)] mt-[var(--px-10)]">
              <ButtonSleek
                text={
                  submitting
                    ? hasPassword
                      ? "Changing Password..."
                      : "Setting Password..."
                    : hasPassword
                      ? "Change Password"
                      : "Set Password"
                }
                onClick={handleSubmit}
              />
              <button
                type="button"
                onClick={onCancel}
                className="px-[var(--px-20)] py-[var(--px-10)] border border-slate-200 border-dotted text-[length:var(--px-11)] font-light font-helvetica hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
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

