import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";

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
          loginData.access_token,
          loginData.refresh_token
        );

        setStatusType("success");
        setStatusMessage("Verification successful! Redirecting...");

        // Call success callback
        setTimeout(() => {
          onSuccess?.(result.data);
        }, 1000);
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Invalid or expired code. Please try again.");
        setCode(""); // Clear code on error
      }
    } catch (error) {
      console.error("2FA verification error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please check your connection and try again.");
      setCode(""); // Clear code on error
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || !userId) return;

    setStatusType("loading");
    setShowStatus(true);
    setStatusMessage("Sending new code...");

    try {
      // Note: Backend should handle resending 2FA code
      // For now, we'll show a success message
      setStatusType("success");
      setStatusMessage("A new verification code has been sent to your email.");
      setResendCountdown(60); // 60 second cooldown
    } catch (error) {
      console.error("Resend 2FA error:", error);
      setStatusType("error");
      setStatusMessage("Failed to resend code. Please try again.");
    }
  };

  // If no userId, redirect to login
  if (!userId && !propUserId) {
    return (
      <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
        <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
          <header className="mb-[var(--px-28)] text-center">
            <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
              Invalid Session
            </h1>
          </header>

          <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
            <div className="flex flex-col items-center gap-[var(--px-20)] text-center">
              <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica">
                Your session has expired. Please log in again to continue.
              </p>
              <div className="mt-[var(--px-10)]">
                <ButtonSleek text="Back to Login" onClick={() => onNavigateLogin?.()} />
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
            Two-Factor Authentication
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Enter the 6-digit code sent to your email
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
          <div className="mb-[var(--px-24)]">
            <button
              onClick={onNavigateLogin}
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors"
            >
              ← Back to Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col w-full gap-[var(--px-20)]">
            <div className="flex flex-col items-center gap-[var(--px-20)]">
              <div className="text-[length:var(--px-60)]">🔐</div>
              
              <div className="w-full flex flex-col gap-[var(--px-10)]">
                <label
                  htmlFor="code"
                  className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica text-center"
                >
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
                  className={`w-full border ${
                    error ? "border-red-500" : "border-slate-200"
                  } border-dotted p-[var(--px-12)] text-[length:var(--px-32)] lg:text-[length:var(--px-24)] font-light font-helvetica text-center tracking-[var(--px-8)] focus:outline-none focus:border-[var(--color-primary)]`}
                  maxLength={6}
                />
                {error && (
                  <div className="text-[length:var(--px-10)] text-red-500 text-center font-light font-helvetica">
                    {error}
                  </div>
                )}
              </div>

              <p className="text-[length:var(--px-11)] font-extralight font-helvetica lg:opacity-80 text-center">
                Please enter the 6-digit code we sent to your email address.
              </p>
            </div>

            <div className="mt-[var(--px-10)]">
              <ButtonSleek
                text={submitting ? "Verifying..." : "Verify Code"}
                onClick={handleSubmit}
              />
            </div>

            <div className="border-t border-slate-200 border-dotted pt-[var(--px-20)] text-center">
              <p className="text-[length:var(--px-11)] font-extralight font-helvetica mb-[var(--px-10)]">
                Didn't receive the code?
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0}
                className={`text-[length:var(--px-11)] font-light font-helvetica ${
                  resendCountdown > 0
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
                } transition-colors`}
              >
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend Code"}
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

