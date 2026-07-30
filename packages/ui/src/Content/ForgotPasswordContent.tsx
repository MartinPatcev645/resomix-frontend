import { useState, FormEvent, ChangeEvent } from "react";
import { validateEmail } from "@resomix/hooks";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";
import { AuthScreen } from "./AuthScreen";
import { AuthDone } from "./AuthDone";
import {
  PAGE_BTN_PRIMARY as BTN_PRIMARY,
  PAGE_BTN_SECONDARY as BTN_SECONDARY,
  PAGE_SUBLABEL as SUBLABEL,
  PAGE_TEXT_LINK as TEXT_LINK,
} from "./pageChrome";

/**
 * Password-reset request, on the shared AuthScreen shell.
 *
 * Behaviour unchanged, including the deliberate security property that a submit always reports
 * success whether or not the address exists. The submit is now a real `type="submit"` (the old
 * ButtonSleek hardcodes `type="button"`, so Enter did nothing).
 */

interface ForgotPasswordContentProps {
  baseUrl?: string;
  onNavigateLogin?: () => void;
  onSuccess?: () => void;
}

export default function ForgotPasswordContent({
                                                baseUrl = "https://resomix.com",
                                                onNavigateLogin,
                                                onSuccess,
                                              }: ForgotPasswordContentProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [emailTouched, setEmailTouched] = useState(false);

  const runEmailValidation = (value: string) => {
    const trimmed = value.trim();
    const result = validateEmail(trimmed);
    if (!result.isValid) {
      setError(result.error || "Please enter a valid email address");
      return false;
    }
    setError("");
    return true;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setEmail(next);

    // If the field has been touched, live-validate on change
    if (emailTouched) {
      runEmailValidation(next);
    } else if (error) {
      // Clear any prior error until blur/submit
      setError("");
    }
  };

  const handleBlur = () => {
    if (!emailTouched) setEmailTouched(true);
    runEmailValidation(email);
  };

  const validate = (): boolean => {
    // Validate using the shared hook util
    return runEmailValidation(email);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    // Mark as touched to show errors if not already
    if (!emailTouched) setEmailTouched(true);

    if (!validate()) return;

    const trimmedEmail = email.trim();

    setSubmitting(true);
    setStatusType("loading");
    setShowStatus(true);

    try {
      const { requestPasswordReset } = await import("@resomix/api-client");
      await requestPasswordReset(trimmedEmail);

      // Always show success message for security
      setStatusType("success");
      setStatusMessage(
        "If an account exists with this email, you will receive a password reset link shortly."
      );
      setSubmitted(true);

      setTimeout(() => {
        onSuccess?.();
      }, 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      // Still show success for security
      setStatusType("success");
      setStatusMessage(
        "If an account exists with this email, you will receive a password reset link shortly."
      );
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen
      eyebrow="Account // Reset"
      title="Forgot Password?"
      lead="Enter your email address and we'll send you a reset link."
      backControl={
        <button type="button" onClick={onNavigateLogin} className={`${BTN_SECONDARY} gap-[var(--px-6)]`}>
          <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Login
        </button>
      }
      panelLabel={submitted ? "Link sent" : "Recover access"}
      footer={
        submitted ? undefined : (
          <>
            <span className={SUBLABEL}>Remember your password?</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevents focus change (and blur)
                onNavigateLogin?.();
              }}
              className={TEXT_LINK}
            >
              Sign in here
            </button>
          </>
        )
      }
    >
      {!submitted ? (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[var(--px-18)] p-[var(--px-20)]">
          <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)] opacity-80">
            Enter the email address associated with your account and we'll send you a link to reset
            your password.
          </p>

          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={email}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="your@email.com"
            required
            autoFocus
            autoComplete="email"
            error={error}
          />

          <button
            type="submit"
            disabled={submitting}
            className={`${BTN_PRIMARY} w-full !min-h-[var(--px-44)] !px-[var(--px-22)]`}
          >
            {submitting ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      ) : (
        <AuthDone
          eyebrow="Status // Sent"
          message="Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder."
          actions={
            <button
              type="button"
              onClick={() => onNavigateLogin?.()}
              className={`${BTN_PRIMARY} !min-h-[var(--px-44)] !px-[var(--px-22)]`}
            >
              Back to Login
            </button>
          }
        />
      )}

      <StatusMessage
        isOpen={showStatus}
        onClose={() => setShowStatus(false)}
        status={statusType}
        message={statusMessage}
      />
    </AuthScreen>
  );
}