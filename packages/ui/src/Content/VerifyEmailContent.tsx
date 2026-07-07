import { useState, useEffect, useRef, ChangeEvent } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";
import { SineWaves } from "../Animations/SineWaves";

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
      <section className="pt-[var(--px-120)] px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <header className="mb-[var(--px-28)] text-center">
            <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
              Email Verified!
            </h1>
          </header>

          <div className="max-w-[var(--px-550)] p-[var(--px-20)] w-full">
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
      <section className="pt-[var(--px-120)] px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <header className="mb-[var(--px-28)] text-center">
            <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
              Verification Failed
            </h1>
          </header>

          <div className="max-w-[var(--px-550)]  p-[var(--px-20)] w-full">
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
              <div className="w-full max-w-[var(--px-300)] h-[150px]">
                <SineWaves />
              </div>
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

        <div className="max-w-[var(--px-550)] p-[var(--px-20)] w-full">
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
            <img 
              src="https://resomix.com/letter.png" 
              alt="Email icon" 
              className="w-[var(--px-60)] h-auto"
            />
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica">
              We've sent a verification link to your email address. Please check your inbox and
              click the link to verify your account.
            </p>
            <p className="text-[length:var(--px-11)] font-extralight font-helvetica lg:opacity-80">
              If you don't see the email, check your spam folder.
            </p>

            <div className="border-t border-slate-200 border-dotted pt-[var(--px-20)] w-full flex flex-col items-center gap-[var(--px-10)]">
              <p className="text-[length:var(--px-11)] font-extralight font-helvetica">
                Didn't receive the email?
              </p>
              {!email && (
                <div className="w-full max-w-[var(--px-320)]">
                  <FormInput
                    label="Email Address"
                    name="resend-email"
                    type="email"
                    value={emailInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailInput(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              )}
              <ButtonSleek
                text={resendLabel}
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

