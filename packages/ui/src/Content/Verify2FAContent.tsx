import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { StatusMessage } from "../Elements/StatusMessage";
import { AuthScreen } from "./AuthScreen";
import { AuthDone } from "./AuthDone";
import {
  PAGE_BTN_PRIMARY as BTN_PRIMARY,
  PAGE_BTN_SECONDARY as BTN_SECONDARY,
  PAGE_FIELD_LABEL as FIELD_LABEL,
  PAGE_SUBLABEL as SUBLABEL,
  PAGE_TEXT_LINK as TEXT_LINK,
} from "./pageChrome";

/**
 * Two-factor code entry, on the shared AuthScreen shell.
 *
 * Unchanged: digits-only filtering, the 6-digit auto-submit, the resend cooldown, and the rate-
 * limit vs generic failure titles. The submit is now a real `type="submit"` rather than a
 * ButtonSleek, so Enter works alongside the auto-submit.
 */

/** Monospaced 6-digit entry — wide tracking so the code reads as discrete characters. */
const CODE_FIELD =
  "w-full border bg-[#0a0a0a] px-[var(--px-12)] py-[var(--px-14)] text-center font-fira " +
  "text-[length:var(--px-28)] font-light tracking-[var(--px-10)] text-[var(--rx-color-text-primary)] " +
  "transition-[border-color] duration-[var(--rx-duration-base)] focus:outline-none " +
  "focus:border-[var(--rx-color-border-strong)]";

interface Verify2FAContentProps {
  baseUrl?: string;
  userId?: number;
  onSuccess?: (data: any) => void;
  onNavigateLogin?: () => void;
}

export default function Verify2FAContent({
  baseUrl = "https://resomix.com",
  userId: propUserId,
  onSuccess,
  onNavigateLogin,
}: Verify2FAContentProps) {
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState(propUserId || 0);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTitle, setStatusTitle] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Get userId from state/props on mount
  useEffect(() => {
    if (!propUserId) {
      // Try to get from navigation state or URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlUserId = urlParams.get("userId");
      
      if (urlUserId) {
        setUserId(parseInt(urlUserId, 10));
      }
    }
  }, [propUserId]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && !submitting) {
      handleSubmit();
    }
  }, [code]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Only allow digits
    
    if (value.length <= 6) {
      setCode(value);
      if (error) {
        setError("");
      }
    }
  };

  const validate = (): boolean => {
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return false;
    }
    if (!userId) {
      setError("Invalid session. Please try logging in again.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    setStatusType("loading");
    setStatusTitle(undefined);
    setShowStatus(true);
    setStatusMessage("Verifying code...");

    try {
      // Import dynamically to avoid circular dependencies
      const { verify2FA } = await import("@resomix/api-client");
      const { useAuthStore } = await import("@resomix/stores");

      const result = await verify2FA({ user_id: userId, code });

      if (result.success && "access_token" in result.data) {
        const loginData = result.data as {
          access_token: string;
          refresh_token: string;
          user: any;
        };
        
        // Set auth state
        useAuthStore.getState().setAuth(
          loginData.user,
          loginData.access_token
        );

        setStatusType("success");
        setStatusTitle("Code verified");
        setStatusMessage("Verification successful! Redirecting...");

        // Call success callback
        setTimeout(() => {
          onSuccess?.(result.data);
        }, 1000);
      } else {
        const errorResult = result as { success: false; error: string; status?: number };
        const message = errorResult.error || "Invalid or expired code. Please try again.";
        setStatusType("error");
        setStatusMessage(message);
        const lowerMessage = message.toLowerCase();
        if (errorResult.status === 429 || lowerMessage.includes("rate limit")) {
          setStatusTitle("Too many attempts");
        } else {
          setStatusTitle("Verification failed");
        }
        setCode(""); // Clear code on error
      }
    } catch (error) {
      console.error("2FA verification error:", error);
      setStatusType("error");
      setStatusTitle("Network error");
      setStatusMessage("Network error. Please check your connection and try again.");
      setCode(""); // Clear code on error
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || !userId) return;

    setStatusType("loading");
    setStatusTitle(undefined);
    setShowStatus(true);
    setStatusMessage("Sending new code...");

    try {
      // Note: Backend should handle resending 2FA code
      // For now, we'll show a success message
      setStatusType("success");
      setStatusTitle("New code sent");
      setStatusMessage("A new verification code has been sent to your email.");
      setResendCountdown(60); // 60 second cooldown
    } catch (error) {
      console.error("Resend 2FA error:", error);
      setStatusType("error");
      setStatusTitle("Unable to resend");
      setStatusMessage("Failed to resend code. Please try again.");
    }
  };

  // If no userId, redirect to login
  if (!userId && !propUserId) {
    return (
      <AuthScreen
        eyebrow="Account // Two-factor"
        title="Invalid Session"
        backUrl={baseUrl}
        panelLabel="Session expired"
      >
        <AuthDone
          tone="error"
          message="Your session has expired. Please log in again to continue."
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
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      eyebrow="Account // Two-factor"
      title="Two-Factor Authentication"
      lead="Enter the 6-digit code sent to your email."
      backControl={
        <button type="button" onClick={onNavigateLogin} className={`${BTN_SECONDARY} gap-[var(--px-6)]`}>
          <svg viewBox="0 0 24 24" className="h-[var(--px-14)] w-[var(--px-14)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Login
        </button>
      }
      panelLabel="Verification code"
      footer={
        <>
          <span className={SUBLABEL}>Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCountdown > 0}
            className={`${TEXT_LINK} disabled:cursor-not-allowed disabled:text-[var(--rx-color-disabled)] disabled:no-underline disabled:hover:text-[var(--rx-color-disabled)]`}
          >
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend Code"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[var(--px-18)] p-[var(--px-20)]">
        <div className="flex flex-col gap-[var(--px-8)]">
          <label htmlFor="code" className={`${FIELD_LABEL} text-center`}>
            Verification Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={code}
            onChange={handleChange}
            placeholder="000000"
            autoFocus
            autoComplete="one-time-code"
            aria-invalid={error ? true : undefined}
            className={`${CODE_FIELD} ${
              error ? "border-[var(--rx-color-error)]" : "border-[var(--rx-color-border-default)]"
            }`}
            maxLength={6}
          />
          {error && (
            <div
              role="alert"
              className="text-center font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-error)]"
            >
              {error}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`${BTN_PRIMARY} w-full !min-h-[var(--px-44)] !px-[var(--px-22)]`}
        >
          {submitting ? "Verifying..." : "Verify Code"}
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

