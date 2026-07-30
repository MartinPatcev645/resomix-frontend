import { useState, FormEvent, ChangeEvent } from "react";
import { StatusMessage } from "../Elements/StatusMessage";
import { PasswordInput } from "../Elements/PasswordInput";
import { useAuthStore } from "@resomix/stores";
import {
  PAGE_BTN_PRIMARY,
  PAGE_BTN_SECONDARY,
  PAGE_PANEL,
  PAGE_SUBLABEL,
} from "./pageChrome";

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
    // Spacing matches the workspace / profile shell: a small inset from the vertical side lines and
    // no oversized top pad — the layout's <main> already offsets the header.
    <section className="px-[var(--px-12)] pt-[var(--px-16)] pb-[var(--px-40)] tracking-[var(--px-1)]">
      <div className="mx-auto w-full max-w-[var(--px-680)] text-[var(--rx-color-text-primary)]">
        {/* Header — accent rule + mono kicker, then a left-aligned heading, as on the workspace. */}
        <header className="mb-[var(--px-24)]">
          <p className="mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)] before:block before:w-[var(--px-32)] before:border-t before:border-[var(--rx-color-accent)] before:content-['']">
            Account // Security
          </p>
          <h1 className="m-0 font-helvetica text-[length:var(--px-28)] font-medium uppercase leading-[var(--px-32)] md:text-[length:var(--px-36)] md:leading-[var(--px-40)]">
            {hasPassword ? "Change Password" : "Set Password"}
          </h1>
          <p className="mt-[var(--px-12)] font-helvetica text-[length:var(--px-15)] font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)] opacity-70">
            {hasPassword
              ? "Update your account password"
              : "Add a password so you can also sign in with email — your Google sign-in keeps working"}
          </p>
        </header>

        <div className="mb-[var(--px-24)]">
          <button type="button" onClick={onCancel} className={`${PAGE_BTN_SECONDARY} gap-[var(--px-6)]`}>
            <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Profile
          </button>
        </div>

        <div className={PAGE_PANEL}>
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[var(--px-18)]">
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
              <div className="-mt-[var(--px-8)] flex flex-col gap-[var(--px-6)] border border-[var(--rx-color-border-subtle)] bg-[rgba(255,255,255,0.02)] p-[var(--px-14)]">
                <div className={PAGE_SUBLABEL}>Password requirements</div>
                {passwordRequirements.map((req, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-[var(--px-8)] font-helvetica text-[length:var(--px-12)] font-light"
                  >
                    <span
                      aria-hidden="true"
                      className={req.met ? "text-[var(--rx-color-success)]" : "text-[var(--rx-color-text-muted)]"}
                    >
                      {req.met ? "\u2713" : "\u25CB"}
                    </span>
                    <span className={req.met ? "text-[var(--rx-color-success)]" : "text-[var(--rx-color-text-secondary)] opacity-70"}>
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

            <div className="mt-[var(--px-6)] flex flex-wrap justify-end gap-[var(--px-10)]">
              <button type="button" onClick={onCancel} className={PAGE_BTN_SECONDARY}>
                Cancel
              </button>
              {/* A real submit with NO onClick — the form's onSubmit is the single entry point, so
                  it runs once per click AND Enter works. (It fired twice only in the previous
                  shape, which had both an onClick and an implicit submit.) */}
              <button type="submit" disabled={submitting} className={PAGE_BTN_PRIMARY}>
                {submitting
                  ? hasPassword
                    ? "Changing Password..."
                    : "Setting Password..."
                  : hasPassword
                    ? "Change Password"
                    : "Set Password"}
              </button>
            </div>
          </form>
        </div>

        <StatusMessage
          isOpen={showStatus}
          onClose={() => setShowStatus(false)}
          status={statusType}
          message={statusMessage}
        />
      </div>
    </section>
  );
}
