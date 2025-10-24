import { useState, FormEvent, ChangeEvent } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";

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
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) {
      setError("");
    }
  };

  const validate = (): boolean => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setError("Email is required");
      return false;
    } else if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
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

    try {
      // Import dynamically to avoid circular dependencies
      const { requestPasswordReset } = await import("@resomix/api-client");

      await requestPasswordReset(email);

      // Always show success message for security (don't reveal if email exists)
      setStatusType("success");
      setStatusMessage(
        "If an account exists with this email, you will receive a password reset link shortly."
      );
      setSubmitted(true);

      // Call success callback after delay
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
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Forgot Password?
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Enter your email address and we'll send you a reset link
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
          <div className="mb-[var(--px-24)]">
            <button
              onClick={onNavigateLogin}
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
            >
              ← Back to Login
            </button>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col w-full gap-[var(--px-20)]">
              <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-extralight font-helvetica lg:opacity-80">
                Enter the email address associated with your account and we'll send you a link
                to reset your password.
              </p>

              <FormInput
                label="Email Address"
                name="email"
                type="email"
                value={email}
                onChange={handleChange}
                placeholder="your@email.com"
                required
                autoFocus
                autoComplete="email"
                error={error}
              />

              <div className="mt-[var(--px-10)] flex justify-center">
                <ButtonSleek
                  text={submitting ? "Sending..." : "Send Reset Link"}
                  onClick={handleSubmit}
                />
              </div>

              <div className="text-center mt-[var(--px-10)]">
                <span className="text-[length:var(--px-11)] font-extralight font-helvetica">
                  Remember your password?{" "}
                </span>
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  className="text-[length:var(--px-11)] font-light font-helvetica text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
                >
                  Sign in here
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-[var(--px-20)] text-center">
              <div className="text-[length:var(--px-60)] text-green-500">✓</div>
              <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica">
                Check your email for a link to reset your password. If it doesn't appear within
                a few minutes, check your spam folder.
              </p>
              <div className="mt-[var(--px-10)]">
                <ButtonSleek text="Back to Login" onClick={() => onNavigateLogin?.()} />
              </div>
            </div>
          )}

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

