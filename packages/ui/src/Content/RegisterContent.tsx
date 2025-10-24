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
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";
import { PasswordInput } from "../Elements/PasswordInput";

interface RegisterContentProps {
  baseUrl?: string;
  onRegisterSuccess?: () => void;
  onNavigateLogin?: () => void;
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

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValue(name as keyof typeof form, value);

    // Clear confirmPassword error when either password field changes
    if (name === "password" || name === "confirmPassword") {
      setConfirmPasswordError(undefined);
    }
  };

  const handleBlur = (name: keyof typeof form) => {
    setFieldTouched(name);
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

        // Call success callback after delay
        setTimeout(() => {
          onRegisterSuccess?.();
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
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            Create Account
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            Join ResomiX today and discover similar music
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)] w-full">
          <div className="mb-[var(--px-24)]">
            <a
              href={baseUrl}
              aria-label="Resomix home"
              className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors cursor-pointer"
            >
              ← Back to Home
            </a>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col w-full gap-[var(--px-20)]">
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

            {form.password && (
              <div className="flex flex-col gap-[var(--px-8)] -mt-[var(--px-10)]">
                <div className="text-[length:var(--px-10)] font-extralight font-helvetica">
                  Password requirements:
                </div>
                {passwordRequirements.map((req, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-[var(--px-8)] text-[length:var(--px-10)] font-light font-helvetica"
                  >
                    <span className={req.met ? "text-green-500" : "text-gray-400"}>
                      {req.met ? "✓" : "○"}
                    </span>
                    <span className={req.met ? "text-green-500" : "text-gray-400"}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

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

            <div className="flex flex-col gap-[var(--px-10)] border-t border-slate-200 border-dotted pt-[var(--px-20)]">
              <div className="flex items-start gap-[var(--px-10)]">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked && privacyAccepted) setTermsError(undefined);
                  }}
                  className="mt-[var(--px-1)] cursor-pointer"
                />
                <label
                  htmlFor="terms"
                  className="text-[length:var(--px-11)] font-light font-helvetica cursor-pointer leading-relaxed"
                >
                  I agree to the{" "}
                  <a
                    href={`${baseUrl}/terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline"
                  >
                    Terms of Service
                  </a>
                </label>
              </div>

              <div className="flex items-start gap-[var(--px-10)]">
                <input
                  type="checkbox"
                  id="privacy"
                  checked={privacyAccepted}
                  onChange={(e) => {
                    setPrivacyAccepted(e.target.checked);
                    if (e.target.checked && termsAccepted) setTermsError(undefined);
                  }}
                  className="mt-[var(--px-1)] cursor-pointer"
                />
                <label
                  htmlFor="privacy"
                  className="text-[length:var(--px-11)] font-light font-helvetica cursor-pointer leading-relaxed"
                >
                  I agree to the{" "}
                  <a
                    href={`${baseUrl}/privacy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline"
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>

              {termsError && (
                <div className="text-[length:var(--px-10)] text-red-500 font-light font-helvetica">
                  {termsError}
                </div>
              )}
            </div>

            <div className="mt-[var(--px-10)] flex justify-center">
              <ButtonSleek
                text={submitting ? "Creating Account..." : "Create Account"}
                onClick={handleSubmit}
              />
            </div>

            <div className="text-center mt-[var(--px-10)]">
              <span className="text-[length:var(--px-11)] font-extralight font-helvetica">
                Already have an account?{" "}
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

