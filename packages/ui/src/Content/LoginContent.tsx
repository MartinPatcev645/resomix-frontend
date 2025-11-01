import { useState, FormEvent, ChangeEvent } from "react";
import { useFormValidation, validateRequired } from "@resomix/hooks";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { StatusMessage } from "../Elements/StatusMessage";
import { FormInput } from "../Elements/FormInput";
import { PasswordInput } from "../Elements/PasswordInput";

interface LoginContentProps {
  baseUrl?: string;
  onLoginSuccess?: (data: any) => void;
  onNavigateRegister?: () => void;
  onNavigateForgotPassword?: () => void;
  onNavigate2FA?: (userId: number) => void;
}

export default function LoginContent({
  baseUrl = "https://resomix.com",
  onLoginSuccess,
  onNavigateRegister,
  onNavigateForgotPassword,
  onNavigate2FA,
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
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValue(name as keyof typeof form, value);
  };

  const handleBlur = (name: keyof typeof form) => {
    setFieldTouched(name);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setStatusType("loading");
    setShowStatus(true);

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
          setStatusMessage("Login successful! Redirecting...");

          // Wait a bit longer to ensure cookie is persisted before cross-domain redirect
          // This prevents localStorage flashing when redirecting between subdomains
          setTimeout(() => {
            onLoginSuccess?.(result.data);
          }, 2000);
        } else {
          setStatusType("error");
          setStatusMessage("Unexpected response from server");
        }
      } else {
        const errorResult = result as { success: false; error: string };
        setStatusType("error");
        setStatusMessage(errorResult.error || "Invalid credentials. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setStatusType("error");
      setStatusMessage("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
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
            onClose={() => setShowStatus(false)}
            status={statusType}
            message={statusMessage}
          />
        </div>
      </div>
    </section>
  );
}

