import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import { useFormValidation, validateRequired } from "@resomix/hooks";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";
import { PasswordInput } from "../Elements/PasswordInput";
import { GoogleSignInButton } from "../Auth/GoogleSignInButton";

import { AuthScreen } from "./AuthScreen";
import {
  PAGE_BTN_PRIMARY as BTN_PRIMARY,
  PAGE_SUBLABEL as SUBLABEL,
  PAGE_TEXT_LINK as TEXT_LINK,
} from "./pageChrome";

/**
 * Sign-in screen in the precision-industrial theme, matching Profile / Library / Contact / 404:
 * accent rule + mono kicker, large uppercase heading, then a single bordered panel on a solid
 * surface carrying the credentials.
 *
 * Narrow single column on purpose — a login form has one job, so there is no sidebar and the
 * primary action spans the panel.
 *
 * The sign-in logic is untouched: the same useFormValidation rules, the same login → 2FA /
 * success / verify-email branches, and the same StatusMessage (including the resend-verification
 * action).
 *
 * Two behavioural differences fall out of the markup, both fixes rather than redesign:
 *  • Sign In is a real `type="submit"`. The old button was a ButtonSleek, which hardcodes
 *    `type="button"` — so the form had NO submit control and pressing Enter in a field did
 *    nothing. It now submits, as a login form should.
 *  • Sign In disables itself while a request is in flight, so it cannot be double-fired.
 */

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
  const [submitAttempted, setSubmitAttempted] = useState(false);

  /**
   * Field errors stay hidden until the first submit attempt.
   *
   * The email field is autoFocused, so useFormValidation's blur validation fired the moment you
   * clicked anywhere else on the page — greeting you with "Email or username is required" before
   * you had typed a single character. Errors are only useful once you have actually tried to sign
   * in; from that point they do live-update, because handleSubmit marks every field touched.
   */
  const fieldError = (name: keyof typeof form) =>
    submitAttempted ? getFieldError(name) : undefined;

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

  const handleGoogleError = (message: string, code?: string | null) => {
    setStatusType("error");
    // A deactivated account is not a Google problem — framing it as one sends the user off to
    // debug their Google account instead of contacting us.
    if (code === "ACCOUNT_DEACTIVATED") {
      setStatusTitle("Account deactivated");
      setStatusMessage(
        "This account has been deactivated, so you can't sign in. If you asked us to delete it, " +
          "your data is kept for 30 days — contact support before then and we can restore everything."
      );
      setShowResendCTA(false);
      return;
    }
    setStatusTitle("Google sign-in failed");
    setStatusMessage(message || "We couldn't sign you in with Google. Please try again.");
    setShowResendCTA(false);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    // Reveal errors from here on, and mark both fields touched so useFormValidation re-validates
    // them as the user types — otherwise a message would sit there until the field was blurred.
    setSubmitAttempted(true);
    (Object.keys(form) as (keyof typeof form)[]).forEach((name) => setFieldTouched(name));

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
        const errorResult = result as {
          success: false;
          error: string;
          status?: number;
          code?: string | null;
        };
        const trimmedInput = form.email_or_username.trim();
        setStatusType("error");

        // Branch on the CODE, not the HTTP status.
        //
        // This used to read `status === 403`, which was fine only while an unverified email was
        // the single reason login could 403. It isn't any more: a deactivated account refuses with
        // the same status, and was being shown "Verify your email" plus a resend button that could
        // never help.
        //
        // The `not verified` string check stays as a fallback for a browser on a cached bundle
        // talking to a server that has not been updated yet.
        const isDeactivated = errorResult.code === "ACCOUNT_DEACTIVATED";
        const needsVerification =
          !isDeactivated &&
          (errorResult.code === "EMAIL_NOT_VERIFIED" ||
            errorResult.error?.toLowerCase().includes("not verified"));

        if (isDeactivated) {
          setStatusTitle("Account deactivated");
          setStatusMessage(
            "This account has been deactivated, so you can't sign in. If you asked us to delete " +
              "it, your data is kept for 30 days — contact support before then and we can restore " +
              "everything exactly as you left it."
          );
          setShowResendCTA(false);
        } else if (needsVerification) {
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
    <AuthScreen
      eyebrow="Account // Sign in"
      title="Welcome Back"
      lead="Sign in to your account to continue."
      // baseUrl is the beta workspace in both apps, so this exits where Profile and Library do.
      backUrl={baseUrl}
      panelLabel="Credentials"
      panelNote="Secure sign-in"
      footer={
        <>
          <span className={SUBLABEL}>Don't have an account?</span>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // prevents focus change (and blur)
              onNavigateRegister?.();
            }}
            className={TEXT_LINK}
          >
            Register here
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[var(--px-18)] p-[var(--px-20)]">
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
              error={fieldError("email_or_username")}
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
              error={fieldError("password")}
            />

            <div className="flex justify-end">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevents focus change (and blur)
                  onNavigateForgotPassword?.();
                }}
                className={TEXT_LINK}
              >
                Forgot password?
              </button>
            </div>

            {/* Sign In and Google sit side by side on one row. Sign In takes the leftover space;
                the Google control cannot flex — GIS renders a fixed-width button and the wrapper
                carries that width as an inline style — so it is the fixed member of the pair.
                Below `sm` they stack, with an "or" between them.

                `!` on the sizing because PAGE_BTN_BASE already sets min-h/px, and two arbitrary
                values of the same utility resolve by stylesheet order, not by order in this
                string. */}
            <div className="flex flex-col items-stretch gap-[var(--px-12)] sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={submitting}
                className={`${BTN_PRIMARY} w-full !min-h-[var(--px-44)] !px-[var(--px-22)] sm:w-auto sm:flex-1`}
              >
                {submitting ? "Signing in..." : "Sign In"}
              </button>

              {googleClientId && (
                <>
                  <div aria-hidden="true" className="flex items-center gap-[var(--px-12)] sm:hidden">
                    <span className="h-px flex-1 bg-[var(--rx-color-border-subtle)]" />
                    <span className={SUBLABEL}>or</span>
                    <span className="h-px flex-1 bg-[var(--rx-color-border-subtle)]" />
                  </div>

                  <GoogleSignInButton
                    clientId={googleClientId}
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    width={240}
                    className="mx-auto shrink-0 sm:mx-0"
                    surface="login"
                  />
                </>
              )}
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
    </AuthScreen>
  );
}

