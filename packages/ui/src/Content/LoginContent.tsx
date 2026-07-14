import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { useFormValidation, validateRequired } from "@resomix/hooks";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";
import { PasswordInput } from "../Elements/PasswordInput";
import { GoogleSignInButton } from "../Auth/GoogleSignInButton";

interface LoginContentProps {
  baseUrl?: string;
  onLoginSuccess?: (data: any) => void;
  onNavigateRegister?: () => void;
  onNavigateForgotPassword?: () => void;
  onNavigate2FA?: (userId: number) => void;
  /** When provided, shows the "Continue with Google" button above the email/password form. */
  googleClientId?: string;
}

export default function LoginContent({
  baseUrl = "https://resomix.com",
  onLoginSuccess,
  onNavigateRegister,
  onNavigateForgotPassword,
  onNavigate2FA,
  googleClientId,
}: LoginContentProps) {
  // Form validation hook
  const {
    values: form,
    errors,
    setValue,
    setFieldTouched,
    validateForm,
    getFieldError,
  } = useFormValidation(
    {
      email_or_username: "",
      password: "",
    },
    {
      email_or_username: (value) => validateRequired(value, "Email or username"),
      password: (value) => validateRequired(value, "Password"),
    }
  );

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTitle, setStatusTitle] = useState<string | undefined>(undefined);
  const [showResendCTA, setShowResendCTA] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const logoutReason = sessionStorage.getItem("auth_logout_reason");
      if (logoutReason === "refresh_token_reuse") {
        sessionStorage.removeItem("auth_logout_reason");
        setStatusType("error");
        setStatusTitle("Session Ended");
        setStatusMessage("For your security we ended your sessions on all devices. Please sign in again.");
        setShowResendCTA(false);
        setShowStatus(true);
      }
    } catch {
      // Ignore storage access issues (e.g., Safari private mode)
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValue(name as keyof typeof form, value);
  };

  const handleBlur = (name: keyof typeof form) => {
    setFieldTouched(name);
  };

  // Google sign-in already populated the auth store (in the shared credential handler); here we just
  // surface the same success/redirect UX as a password login.
  const handleGoogleSuccess = (data: any) => {
    setStatusType("success");
    setStatusTitle("Login successful");
    setStatusMessage("Login successful! Redirecting...");
    setShowResendCTA(false);
    setShowStatus(true);
    setTimeout(() => {
      onLoginSuccess?.(data);
    }, 1500);
  };

  const handleGoogleError = (message: string) => {
    setStatusType("error");
    setStatusTitle("Google sign-in failed");
    setStatusMessage(message || "We couldn't sign you in with Google. Please try again.");
    setShowResendCTA(false);
    setShowStatus(true);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setStatusType("loading");
    setStatusTitle(undefined);
    setStatusMessage("");
    setShowStatus(true);
    setShowResendCTA(false);
    setResendPending(false);

    try {
      // Import dynamically to avoid circular dependencies
      const { login } = await import("@resomix/api-client");
      const { useAuthStore } = await import("@resomix/stores");

      const result = await login({
        email_or_username: form.email_or_username,
        password: form.password,
      });

      if (result.success) {
        // Check if 2FA is required
        if ("requires_2fa" in result.data && result.data.requires_2fa) {
          const twoFAData = result.data as { requires_2fa: true; user_id: number; message: string };
          setStatusType("success");
          setStatusTitle("Two-factor verification required");
          setStatusMessage("Please enter your 2FA code");
          setTimeout(() => {
            onNavigate2FA?.(twoFAData.user_id);
          }, 1000);
        } else if ("access_token" in result.data) {
          // Successful login
          const loginData = result.data as { access_token: string; refresh_token: string; user: any };
          useAuthStore.getState().setAuth(
            loginData.user,
            loginData.access_token
          );
          setStatusType("success");
          setStatusTitle("Login successful");
          setStatusMessage("Login successful! Redirecting...");

          // Wait a bit longer to ensure cookie is persisted before cross-domain redirect
          // This prevents localStorage flashing when redirecting between subdomains
          setTimeout(() => {
            onLoginSuccess?.(result.data);
          }, 2000);
        } else {
          setStatusType("error");
          setStatusTitle("Unexpected response");
          setStatusMessage("Unexpected response from server");
        }
      } else {
        const errorResult = result as { success: false; error: string; status?: number };
        const trimmedInput = form.email_or_username.trim();
        setStatusType("error");
        if (errorResult.status === 403 || errorResult.error?.toLowerCase().includes("not verified")) {
          const emailHint = trimmedInput && trimmedInput.includes("@")
            ? `We just sent ${trimmedInput} a verification email when you signed up.`
            : "Please check the inbox associated with your account.";
          setStatusTitle("Verify your email");
          setStatusMessage(
            `${errorResult.error || "Your email address is not verified yet."} ${emailHint} You can request another email below.`
          );
          setShowResendCTA(true);
        } else {
          setStatusTitle("Sign-in failed");
        setStatusMessage(errorResult.error || "Invalid credentials. Please try again.");
          setShowResendCTA(false);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      setStatusType("error");
      setStatusTitle("Network error");
      setStatusMessage("Network error. Please check your connection and try again.");
      setShowResendCTA(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const trimmedInput = form.email_or_username.trim();

    if (!trimmedInput || !trimmedInput.includes("@")) {
      setStatusType("error");
      setStatusTitle("Enter your email");
      setStatusMessage("Enter the email address you used to create your account so we can resend the verification link.");
      setShowStatus(true);
      setShowResendCTA(true);
      return;
    }

    setResendPending(true);
    setShowResendCTA(true);

    try {
      const { resendVerification } = await import("@resomix/api-client");
      const result = await resendVerification(trimmedInput);

      if (result.success) {
        setStatusType("success");
        setStatusTitle("Verification email sent");
        setStatusMessage(`We sent a new verification link to ${trimmedInput}. Check your inbox and spam folder.`);
        setShowResendCTA(false);
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusTitle("Unable to resend");
        setStatusMessage(errorResult.error || "We couldn't resend the verification email. Please try again later.");
        setShowResendCTA(true);
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setStatusType("error");
      setStatusTitle("Unable to resend");
      setStatusMessage("We couldn't resend the verification email. Please try again later.");
      setShowResendCTA(true);
    } finally {
      setResendPending(false);
      setShowStatus(true);
    }
  };

  return (
    <section className="pt-[var(--px-120)] px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Welcome Back
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Sign in to your account to continue
          </p>
        </header>

        <div className="max-w-[var(--px-550)] p-[var(--px-20)] w-full">
          <div className="mb-[var(--px-24)]">
            <a
              href={baseUrl}
              aria-label="Resomix home"
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
            >
              ← Back to Home
            </a>
          </div>

          {googleClientId && (
            <div className="mb-[var(--px-20)] flex flex-col items-center gap-[var(--px-16)]">
              <GoogleSignInButton
                clientId={googleClientId}
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
              />
              <div className="flex items-center w-full gap-[var(--px-12)] opacity-60">
                <span className="h-px flex-1 bg-current" />
                <span className="text-[length:var(--px-10)] font-light font-helvetica uppercase">or</span>
                <span className="h-px flex-1 bg-current" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col w-full gap-[var(--px-20)]">
            <FormInput
              label="Email or Username"
              name="email_or_username"
              type="text"
              value={form.email_or_username}
              onChange={handleChange}
              onBlur={() => handleBlur("email_or_username")}
              placeholder="Enter your email or username"
              required
              autoFocus
              autoComplete="username"
              error={getFieldError("email_or_username")}
            />

            <PasswordInput
              label="Password"
              name="password"
              value={form.password}
              onChange={handleChange}
              onBlur={() => handleBlur("password")}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              error={getFieldError("password")}
            />

            <div className="flex justify-end">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevents focus change (and blur)
                  onNavigateForgotPassword?.();
                }}
                className="text-[length:var(--px-11)] font-light font-helvetica text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <div className="mt-[var(--px-10)] flex justify-center">
              <ButtonSleek
                text={submitting ? "Signing in..." : "Sign In"}
                onClick={handleSubmit}
              />
            </div>

            <div className="text-center mt-[var(--px-10)]">
              <span className="text-[length:var(--px-11)] font-extralight font-helvetica">
                Don't have an account?{" "}
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevents focus change (and blur)
                  onNavigateRegister?.();
                }}
                className="text-[length:var(--px-11)] font-light font-helvetica text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
              >
                Register here
              </button>
            </div>
          </form>

          <StatusMessage
            isOpen={showStatus}
            onClose={() => {
              setShowStatus(false);
            }}
            status={statusType}
            title={statusTitle}
            message={statusMessage}
            additionalButton={
              showResendCTA
                ? {
                    text: resendPending ? "Sending..." : "Resend verification email",
                    onClick: handleResendVerification,
                    disabled: resendPending,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </section>
  );
}

