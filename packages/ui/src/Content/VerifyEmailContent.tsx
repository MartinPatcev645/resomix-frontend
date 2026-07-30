import { useState, useEffect, useRef, ChangeEvent } from "react";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";
import { SineWaves } from "../Animations/SineWaves";
import { AuthScreen } from "./AuthScreen";
import { AuthDone } from "./AuthDone";
import {
  PAGE_BTN_PRIMARY as BTN_PRIMARY,
  PAGE_BTN_SECONDARY as BTN_SECONDARY,
  PAGE_SUBLABEL as SUBLABEL,
  PAGE_TEXT_LINK as TEXT_LINK,
} from "./pageChrome";

/**
 * Email verification, on the shared AuthScreen shell. Four states: verifying (token in flight),
 * verified, failed/expired, and "we sent you a link".
 *
 * All logic is unchanged — the one-shot verify guard, the escalating resend cooldown (60s then
 * 5 min), and the resend-target fallback all behave exactly as before.
 */

/** Envelope for the "check your email" state — replaces a remote PNG from resomix.com. */
function EnvelopeMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[var(--px-44)] w-[var(--px-44)] items-center justify-center border border-[var(--rx-color-accent)] text-[var(--rx-color-accent)]"
    >
      <svg viewBox="0 0 24 24" className="h-[var(--px-20)] w-[var(--px-20)]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="5" width="19" height="14" />
        <polyline points="2.5 6.5 12 13 21.5 6.5" />
      </svg>
    </span>
  );
}

interface VerifyEmailContentProps {
  baseUrl?: string;
  token?: string;
  email?: string;
  mode?: "verify" | "sent"; // "verify" = verify with token, "sent" = show email sent message
  onSuccess?: () => void;
  onNavigateLogin?: () => void;
}

export default function VerifyEmailContent({
  baseUrl = "https://resomix.com",
  token: propToken,
  email: propEmail,
  mode: propMode,
  onSuccess,
  onNavigateLogin,
}: VerifyEmailContentProps) {
  const [mode, setMode] = useState<"verify" | "sent" | "success" | "error">(propMode || "verify");
  const [token, setToken] = useState(propToken || "");
  const [email, setEmail] = useState(propEmail || "");
  const [emailInput, setEmailInput] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [verifying, setVerifying] = useState(false);
  // Guards the verify call against React StrictMode's double-invoke (and any double-click), which
  // would otherwise consume the one-time token on the first call and 400 on the second.
  const verifyStartedRef = useRef(false);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");

  // Auto-verify on mount if token exists
  useEffect(() => {
    if (!propToken) {
      // Try to get token from URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get("token");

      // Prefill the email (for the resend flow) from ?email= if the caller didn't pass it.
      const urlEmail = urlParams.get("email");
      if (urlEmail && !email) setEmail(urlEmail);

      if (urlToken) {
        setToken(urlToken);
        verifyEmail(urlToken);
      } else if (!propMode) {
        // No token and no mode specified, default to "sent"
        setMode("sent");
      }
    } else {
      verifyEmail(propToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propToken, propMode]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const verifyEmail = async (verifyToken: string) => {
    if (verifyStartedRef.current) return; // StrictMode / double-click guard — verify only once
    verifyStartedRef.current = true;
    setVerifying(true);
    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Verifying your email...");

    try {
      const { verifyEmail: verifyEmailAPI } = await import("@resomix/api-client");

      const result = await verifyEmailAPI(verifyToken);

      if (result.success) {
        setMode("success");
        setStatusType("success");
        setStatusMessage("Email verified successfully!");

        // Redirect to login after delay
        setTimeout(() => {
          onSuccess?.();
          onNavigateLogin?.();
        }, 2000);
      } else {
        setMode("error");
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Verification failed or link expired.");
      }
    } catch (error) {
      console.error("Email verification error:", error);
      setMode("error");
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    const target = (emailInput || email).trim();
    if (resendCountdown > 0) return;
    if (!target) {
      // No email known yet — prompt the user to enter it (the input is shown below).
      setStatusType("error");
      setShowStatus(true);
      setStatusMessage("Please enter your email address to resend the verification link.");
      return;
    }

    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Sending verification email...");

    try {
      const { resendVerification } = await import("@resomix/api-client");

      const result = await resendVerification(target);

      if (result.success) {
        setStatusType("success");
        setStatusMessage("Verification email sent! Please check your inbox.");
        // Escalating cooldown: first resend after 60s, then every 5 minutes.
        setResendCountdown(resendCount === 0 ? 60 : 300);
        setResendCount((c) => c + 1);
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Failed to send verification email.");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please try again.");
    }
  };

  const resendLabel =
    resendCountdown > 0
      ? `Resend in ${
          resendCountdown >= 60
            ? `${Math.floor(resendCountdown / 60)}:${String(resendCountdown % 60).padStart(2, "0")}`
            : `${resendCountdown}s`
        }`
      : "Resend Verification Email";

  // Success state
  if (mode === "success") {
    return (
      <AuthScreen
        eyebrow="Account // Verify"
        title="Email Verified"
        backUrl={baseUrl}
        panelLabel="Verified"
      >
        <AuthDone
          eyebrow="Status // Verified"
          message="Your email has been successfully verified. You can now sign in to your account."
          actions={
            <button
              type="button"
              onClick={() => onNavigateLogin?.()}
              className={`${BTN_PRIMARY} !min-h-[var(--px-44)] !px-[var(--px-22)]`}
            >
              Go to Login
            </button>
          }
        />
      </AuthScreen>
    );
  }

  // Error state
  if (mode === "error") {
    return (
      <AuthScreen
        eyebrow="Account // Verify"
        title="Verification Failed"
        backUrl={baseUrl}
        panelLabel="Link expired"
      >
        <div className="flex flex-col gap-[var(--px-18)] p-[var(--px-20)]">
          <AuthDone
            tone="error"
            message="This verification link is invalid or has expired. Request a new one below."
          />

          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={emailInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailInput(e.target.value)}
            placeholder="your@email.com"
          />

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCountdown > 0}
            className={`${BTN_PRIMARY} w-full !min-h-[var(--px-44)] !px-[var(--px-22)]`}
          >
            {resendLabel}
          </button>
        </div>

        <StatusMessage
          isOpen={showStatus}
          onClose={() => setShowStatus(false)}
          status={statusType}
          message={statusMessage}
        />
      </AuthScreen>
    );
  }

  // Verifying state
  if (mode === "verify" && verifying) {
    return (
      <AuthScreen eyebrow="Account // Verify" title="Verifying Email" panelLabel="Working">
        <div className="flex flex-col items-center gap-[var(--px-12)] p-[var(--px-28)] text-center">
          <div className="h-[var(--px-120)] w-full max-w-[var(--px-300)]">
            <SineWaves />
          </div>
          <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light text-[var(--rx-color-text-secondary)]">
            Please wait while we verify your email…
          </p>
        </div>
      </AuthScreen>
    );
  }

  // Email sent confirmation state
  return (
    <AuthScreen
      eyebrow="Account // Verify"
      title="Check Your Email"
      backUrl={baseUrl}
      panelLabel="Verification sent"
      footer={
        <>
          <span className={SUBLABEL}>Already verified?</span>
          <button type="button" onClick={onNavigateLogin} className={TEXT_LINK}>
            Back to Login
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-[var(--px-14)] p-[var(--px-28)] text-center">
        <EnvelopeMark />
        <p className="m-0 max-w-[var(--px-400)] font-helvetica text-[length:var(--px-14)] font-light leading-[var(--px-21)] text-[var(--rx-color-text-secondary)]">
          We've sent a verification link to your email address. Check your inbox and click the link
          to verify your account.
        </p>
        <p className={SUBLABEL}>If you don't see it, check your spam folder.</p>
      </div>

      <div className="flex flex-col items-stretch gap-[var(--px-12)] border-t border-dotted border-[var(--rx-color-border-subtle)] p-[var(--px-20)]">
        <span className={`${SUBLABEL} text-center`}>Didn't receive the email?</span>

        {!email && (
          <FormInput
            label="Email Address"
            name="resend-email"
            type="email"
            value={emailInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailInput(e.target.value)}
            placeholder="your@email.com"
          />
        )}

        {/* Disabled during the cooldown — the label already counts down, so the control should
            not invite a click that handleResend would just drop. */}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCountdown > 0}
          className={`${BTN_SECONDARY} w-full !min-h-[var(--px-44)] !px-[var(--px-22)]`}
        >
          {resendLabel}
        </button>
      </div>

      <StatusMessage
        isOpen={showStatus}
        onClose={() => setShowStatus(false)}
        status={statusType}
        message={statusMessage}
      />
    </AuthScreen>
  );
}

