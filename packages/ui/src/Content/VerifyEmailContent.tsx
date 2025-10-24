import { useState, useEffect, ChangeEvent } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";

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
  const [verifying, setVerifying] = useState(false);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");

  // Auto-verify on mount if token exists
  useEffect(() => {
    if (!propToken) {
      // Try to get token from URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get("token");

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
  }, [propToken, propMode]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const verifyEmail = async (verifyToken: string) => {
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
    if (resendCountdown > 0 || !emailInput && !email) return;

    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Sending verification email...");

    try {
      const { resendVerification } = await import("@resomix/api-client");

      const result = await resendVerification(emailInput || email);

      if (result.success) {
        setStatusType("success");
        setStatusMessage("Verification email sent! Please check your inbox.");
        setResendCountdown(60); // 60 second cooldown
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

  // Success state
  if (mode === "success") {
    return (
      <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <header className="mb-[var(--px-28)] text-center">
            <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
              Email Verified!
            </h1>
          </header>

          <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
            <div className="flex flex-col items-center gap-[var(--px-20)] text-center">
              <div className="text-[length:var(--px-60)] text-green-500">✓</div>
              <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica">
                Your email has been successfully verified! You can now sign in to your account.
              </p>
              <div className="mt-[var(--px-10)]">
                <ButtonSleek text="Go to Login" onClick={() => onNavigateLogin?.()} />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (mode === "error") {
    return (
      <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <header className="mb-[var(--px-28)] text-center">
            <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
              Verification Failed
            </h1>
          </header>

          <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
            <div className="flex flex-col items-center gap-[var(--px-20)] text-center">
              <div className="text-[length:var(--px-60)] text-red-500">✕</div>
              <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica">
                This verification link is invalid or has expired. Please request a new verification
                email.
              </p>

              <div className="w-full flex flex-col gap-[var(--px-10)]">
                <FormInput
                  label="Email Address"
                  name="email"
                  type="email"
                  value={emailInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailInput(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              <div className="mt-[var(--px-10)]">
                <ButtonSleek
                  text={
                    resendCountdown > 0
                      ? `Resend in ${resendCountdown}s`
                      : "Resend Verification Email"
                  }
                  onClick={handleResend}
                />
              </div>
            </div>

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

  // Verifying state
  if (mode === "verify" && verifying) {
    return (
      <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <header className="mb-[var(--px-28)] text-center">
            <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
              Verifying Email
            </h1>
          </header>

          <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
            <div className="flex flex-col items-center gap-[var(--px-20)] text-center">
              <div className="animate-spin text-[length:var(--px-60)]">⟳</div>
              <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica">
                Please wait while we verify your email...
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Email sent confirmation state
  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Check Your Email
          </h1>
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

          <div className="flex flex-col items-center gap-[var(--px-20)] text-center">
            <div className="text-[length:var(--px-60)]">✉</div>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica">
              We've sent a verification link to your email address. Please check your inbox and
              click the link to verify your account.
            </p>
            <p className="text-[length:var(--px-11)] font-extralight font-helvetica lg:opacity-80">
              If you don't see the email, check your spam folder.
            </p>

            <div className="border-t border-slate-200 border-dotted pt-[var(--px-20)] w-full">
              <p className="text-[length:var(--px-11)] font-extralight font-helvetica mb-[var(--px-10)]">
                Didn't receive the email?
              </p>
              <ButtonSleek
                text={
                  resendCountdown > 0
                    ? `Resend in ${resendCountdown}s`
                    : "Resend Verification Email"
                }
                onClick={handleResend}
              />
            </div>

            <div className="mt-[var(--px-10)]">
              <button
                onClick={onNavigateLogin}
                className="text-[length:var(--px-11)] font-light font-helvetica text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
              >
                Back to Login
              </button>
            </div>
          </div>

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

