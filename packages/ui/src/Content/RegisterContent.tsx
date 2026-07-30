import { useState, FormEvent, ChangeEvent, useEffect } from "react";
import {
  useFormValidation,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateUsername,
  validateName,
  validateCheckbox,
  calculatePasswordStrength,
} from "@resomix/hooks";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";
import { PasswordInput } from "../Elements/PasswordInput";
import { GoogleSignInButton } from "../Auth/GoogleSignInButton";
import { AuthScreen } from "./AuthScreen";
import { PasswordRequirements } from "./PasswordRequirements";
import {
  PAGE_BTN_PRIMARY as BTN_PRIMARY,
  PAGE_SUBLABEL as SUBLABEL,
  PAGE_TEXT_LINK as TEXT_LINK,
} from "./pageChrome";

/**
 * Registration screen, on the shared AuthScreen shell (see LoginContent for the same treatment).
 *
 * Wider panel than sign-in because the fields pair up two-per-row. Registration logic is
 * unchanged — same validators, same confirm-password and terms checks, same register → verify
 * email flow, same Google branch.
 *
 * The one behavioural fix, matching the sign-in page: Create Account is a real `type="submit"`
 * instead of a ButtonSleek (which hardcodes `type="button"`), so the form actually has a submit
 * control and Enter works.
 */

/** Square consent checkbox, accent when checked — the theme has no rounded controls. */
const CHECKBOX =
  "h-[var(--px-16)] w-[var(--px-16)] shrink-0 cursor-pointer appearance-none border " +
  "border-[var(--rx-color-border-strong)] bg-transparent " +
  "checked:border-[var(--rx-color-accent)] checked:bg-[var(--rx-color-accent)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rx-color-accent)]";

const CONSENT_TEXT =
  "font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-18)] text-[var(--rx-color-text-secondary)]";

const CONSENT_LINK =
  "text-[var(--rx-color-accent)] underline-offset-2 transition-colors hover:text-[var(--rx-color-accent-hover)] hover:underline";


interface RegisterContentProps {
  baseUrl?: string;
  onRegisterSuccess?: (email?: string) => void;
  onNavigateLogin?: () => void;
  /** When provided, shows the "Continue with Google" button below the register form. */
  googleClientId?: string;
  /** Called after a successful Google sign-in (auth store already populated). Google users are
   *  authenticated immediately, so this should redirect like a login — not go to verify-email. */
  onGoogleSuccess?: (data: any) => void;
}

// Define form type
type RegisterForm = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
};

export default function RegisterContent({
    baseUrl = "https://resomix.com",
    onRegisterSuccess,
    onNavigateLogin,
    googleClientId,
    onGoogleSuccess,
  }: RegisterContentProps) {
  // Form validation hook
  const initialValues: RegisterForm = {
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
  };

  const {
    values: form,
    errors,
    setValue,
    setFieldTouched,
    validateForm,
    getFieldError,
    setFormValues,
  } = useFormValidation<RegisterForm>(initialValues, {
    email: validateEmail,
    username: validateUsername,
    password: validatePassword,
    name: (value) => validateName(value, false),
  });

  const [confirmPasswordError, setConfirmPasswordError] = useState<string>();

  // Validate confirm password on blur
  const handleConfirmPasswordBlur = () => {
    const result = validatePasswordConfirmation(form.password, form.confirmPassword);
    setConfirmPasswordError(result.isValid ? undefined : result.error);
  };

  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong">("weak");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string>();

  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<"loading" | "success" | "error">("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Password requirements (simplified based on user requirements)
  const passwordRequirements = [
    { label: "At least 8 characters", met: form.password.length >= 8 },
    { label: "Contains at least one digit", met: /\d/.test(form.password) },
  ];

  // Update password strength when password changes
  useEffect(() => {
    if (form.password) {
      setPasswordStrength(calculatePasswordStrength(form.password));
    } else {
      setPasswordStrength("weak");
    }
  }, [form.password]);

  // Clear confirmPassword error when either password field changes
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValue(name as keyof typeof form, value);
    if (name === "password" || name === "confirmPassword") {
      setConfirmPasswordError(undefined);
    }
  };

  const handleBlur = (name: keyof typeof form) => {
    setFieldTouched(name);
  };

  // Google sign-in already populated the auth store (in the shared credential handler); here we just
  // surface a success message and redirect via onGoogleSuccess (a Google account is already verified,
  // so it skips the email-verification step a password registration goes through).
  const handleGoogleSuccess = (data: any) => {
    setStatusType("success");
    setStatusMessage("Sign-in successful! Redirecting...");
    setShowStatus(true);
    setTimeout(() => {
      onGoogleSuccess?.(data);
    }, 1500);
  };

  const handleGoogleError = (message: string) => {
    setStatusType("error");
    setStatusMessage(message || "We couldn't sign you in with Google. Please try again.");
    setShowStatus(true);
  };

  const validate = (): boolean => {
    // Validate form fields using the validation hook
    const isFormValid = validateForm();

    // Validate confirm password
    const confirmResult = validatePasswordConfirmation(form.password, form.confirmPassword);
    if (!confirmResult.isValid) {
      setConfirmPasswordError(confirmResult.error);
    } else {
      setConfirmPasswordError(undefined);
    }

    // Validate terms and privacy checkboxes
    const termsResult = validateCheckbox(termsAccepted, "You must accept the Terms of Service");
    const privacyResult = validateCheckbox(privacyAccepted, "You must accept the Privacy Policy");
    if (!termsResult.isValid || !privacyResult.isValid) {
      setTermsError("Please accept the Terms of Service and Privacy Policy");
      return false;
    } else {
      setTermsError(undefined);
    }
    return isFormValid && confirmResult.isValid;
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setStatusType("loading");
    setShowStatus(true);

    try {
      // Import dynamically to avoid circular dependencies
      const { register } = await import("@resomix/api-client");
      const registeredEmail = form.email;
      const result = await register({
        email: form.email,
        username: form.username,
        password: form.password,
        name: form.name || undefined,
      });
      if (result.success) {
        setStatusType("success");
        setStatusMessage(
          "Account created successfully! Please check your email to verify your account."
        );

        // Clear form
        setFormValues({
          email: "",
          username: "",
          password: "",
          confirmPassword: "",
          name: "",
        });
        setTermsAccepted(false);
        setPrivacyAccepted(false);

        // Call success callback after delay (pass the email so the verify page can pre-fill resend)
        setTimeout(() => {
          onRegisterSuccess?.(registeredEmail);
        }, 2000);
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Registration failed. Please try again.");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen
      eyebrow="Account // Register"
      title="Create Account"
      lead="Join Resomix today and discover similar music."
      backUrl={baseUrl}
      width="lg"
      panelLabel="Your details"
      panelNote="All fields required unless marked"
      footer={
        <>
          <span className={SUBLABEL}>Already have an account?</span>
          <button type="button" onClick={onNavigateLogin} className={TEXT_LINK}>
            Sign in here
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[var(--px-18)] p-[var(--px-20)]">
        <div className="grid grid-cols-1 gap-x-[var(--px-20)] gap-y-[var(--px-18)] md:grid-cols-2">
              <FormInput
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                onBlur={() => handleBlur("email")}
                placeholder="your@email.com"
                required
                autoFocus
                autoComplete="email"
                error={getFieldError("email")}
              />

              <FormInput
                label="Username"
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
                onBlur={() => handleBlur("username")}
                placeholder="Choose a username"
                required
                autoComplete="username"
                error={getFieldError("username")}
              />
            </div>

        <div className="grid grid-cols-1 gap-x-[var(--px-20)] gap-y-[var(--px-18)] md:grid-cols-2">
          <div>
            <PasswordInput
              label="Password"
              name="password"
              value={form.password}
              onChange={handleChange}
              onBlur={() => handleBlur("password")}
              placeholder="Create a strong password"
              required
              autoComplete="new-password"
              error={getFieldError("password")}
              showStrength={true}
              strength={passwordStrength}
            />

            {form.password && <PasswordRequirements requirements={passwordRequirements} />}
          </div>

          <PasswordInput
            label="Confirm Password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            onBlur={handleConfirmPasswordBlur}
            placeholder="Re-enter your password"
            required
            autoComplete="new-password"
            error={confirmPasswordError}
          />
        </div>

        <FormInput
          label="Name"
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          onBlur={() => handleBlur("name")}
          placeholder="Your full name"
          optional
          autoComplete="name"
          error={getFieldError("name")}
        />

        <fieldset className="flex flex-col gap-[var(--px-12)] border-t border-dotted border-[var(--rx-color-border-subtle)] pt-[var(--px-18)]">
          <legend className="sr-only">Terms and Privacy</legend>

          <label className="flex cursor-pointer items-center gap-[var(--px-10)]">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (e.target.checked && privacyAccepted) setTermsError(undefined);
              }}
              className={CHECKBOX}
            />
            <span className={CONSENT_TEXT}>
              I agree to the{" "}
              <a
                href="https://support.resomix.com/hc/articles/1/3/11/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className={CONSENT_LINK}
              >
                Terms of Service
              </a>
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-[var(--px-10)]">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => {
                setPrivacyAccepted(e.target.checked);
                if (e.target.checked && termsAccepted) setTermsError(undefined);
              }}
              className={CHECKBOX}
            />
            <span className={CONSENT_TEXT}>
              I agree to the{" "}
              <a
                href="https://support.resomix.com/hc/articles/1/3/1/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className={CONSENT_LINK}
              >
                Privacy Policy
              </a>
            </span>
          </label>

          {termsError && (
            <div
              role="alert"
              className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-error)]"
            >
              {termsError}
            </div>
          )}
        </fieldset>

        {/* Same pairing as the sign-in screen: the primary takes the leftover space, Google is the
            fixed member (GIS renders a fixed-width button), stacking with an "or" below `sm`. */}
        <div className="flex flex-col items-stretch gap-[var(--px-12)] sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={submitting}
            className={`${BTN_PRIMARY} w-full !min-h-[var(--px-44)] !px-[var(--px-22)] sm:w-auto sm:flex-1`}
          >
            {submitting ? "Creating Account..." : "Create Account"}
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
              />
            </>
          )}
        </div>
      </form>

      <StatusMessage
        isOpen={showStatus}
        onClose={() => setShowStatus(false)}
        status={statusType}
        message={statusMessage}
      />
    </AuthScreen>
  );
}