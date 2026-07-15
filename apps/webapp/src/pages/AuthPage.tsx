import {
  LoginContent,
  RegisterContent,
  ForgotPasswordContent,
  ResetPasswordContent,
  VerifyEmailContent,
  Verify2FAContent,
  ProfileContent,
  ChangePasswordContent,
  SessionsContent,
} from "@resomix/ui";
import { useNavigate, useLocation } from "react-router-dom";
import { BASE_BETA_URL } from "@resomix/config";

interface LocationState {
  from?: string;
  userId?: number;
  email?: string;
}

interface AuthPageProps {
  mode:
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email"
  | "verify-2fa"
  | "profile"
  | "sessions"
  | "change-password";
}

export default function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation handlers
  const handleNavigateLogin = () => {
    // Preserve redirect information when navigating to login
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const redirectTo = fromState || fromQuery;

    if (redirectTo) {
      navigate("/auth/login", {
        state: { from: redirectTo },
        replace: true
      });
    } else {
      navigate("/auth/login", { replace: true });
    }
  };
  const handleNavigateRegister = () => {
    // Preserve redirect information when navigating to register
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const redirectTo = fromState || fromQuery;

    navigate("/auth/register", {
      state: redirectTo ? { from: redirectTo } : undefined,
      replace: true
    });
  };

  const handleNavigateForgotPassword = () => {
    // Preserve redirect information when navigating to forgot password
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const redirectTo = fromState || fromQuery;

    navigate("/auth/forgot-password", {
      state: redirectTo ? { from: redirectTo } : undefined,
      replace: true
    });
  };
  const handleNavigateProfile = () => navigate("/profile");
  const handleNavigateSessions = () => navigate("/sessions");
  const handleNavigateChangePassword = () => navigate("/change-password");

  // Success handlers
  const handleLoginSuccess = () => {
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const from = fromState || fromQuery || "/";
    navigate(from, { replace: true });
  };

  const handleRegisterSuccess = (email?: string) => {
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const redirectTo = fromState || fromQuery;

    navigate("/auth/verify-email", {
      state: { ...(redirectTo ? { from: redirectTo } : {}), email },
      replace: true
    });
  };

  const handleVerifyEmailSuccess = () => {
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const redirectTo = fromState || fromQuery;

    if (redirectTo) {
      navigate("/auth/login", {
        state: { from: redirectTo },
        replace: true
      });
    } else {
      navigate("/auth/login", { replace: true });
    }
  };

  const handleForgotPasswordSuccess = () => {
    // Stay on the same page to show success message
  };

  const handleResetPasswordSuccess = () => {
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const redirectTo = fromState || fromQuery;

    if (redirectTo) {
      navigate("/auth/login", {
        state: { from: redirectTo },
        replace: true
      });
    } else {
      navigate("/auth/login", { replace: true });
    }
  };

  const handle2FASuccess = () => {
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const from = fromState || fromQuery || "/";
    navigate(from, { replace: true });
  };

  const handleNavigate2FA = (userId: number) => {
    const fromState = (location.state as LocationState)?.from;
    const fromQuery = new URLSearchParams(location.search).get('redirect');
    const redirectTo = fromState || fromQuery;

    navigate("/auth/verify-2fa", {
      state: {
        userId,
        ...(redirectTo && { from: redirectTo })
      },
      replace: true
    });
  };

  const handleChangePasswordSuccess = () => {
    navigate("/profile", { replace: true });
  };

  const handleLogout = () => {
    navigate("/auth/login", { replace: true });
  };

  return (
    <>
      {mode === "login" && (
        <LoginContent
          baseUrl={BASE_BETA_URL}
          onLoginSuccess={handleLoginSuccess}
          onNavigateRegister={handleNavigateRegister}
          onNavigateForgotPassword={handleNavigateForgotPassword}
          onNavigate2FA={handleNavigate2FA}
          googleClientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
        />
      )}
      {mode === "register" && (
        <RegisterContent
          baseUrl={BASE_BETA_URL}
          onRegisterSuccess={handleRegisterSuccess}
          onNavigateLogin={handleNavigateLogin}
        />
      )}
      {mode === "forgot-password" && (
        <ForgotPasswordContent
          baseUrl={BASE_BETA_URL}
          onNavigateLogin={handleNavigateLogin}
          onSuccess={handleForgotPasswordSuccess}
        />
      )}
      {mode === "reset-password" && (
        <ResetPasswordContent
          baseUrl={BASE_BETA_URL}
          onSuccess={handleResetPasswordSuccess}
          onNavigateLogin={handleNavigateLogin}
          onNavigateForgotPassword={handleNavigateForgotPassword}
        />
      )}
      {mode === "verify-email" && (
        <VerifyEmailContent
          baseUrl={BASE_BETA_URL}
          email={(location.state as LocationState)?.email}
          onSuccess={handleVerifyEmailSuccess}
          onNavigateLogin={handleNavigateLogin}
        />
      )}
      {mode === "verify-2fa" && (
        <Verify2FAContent
          baseUrl={BASE_BETA_URL}
          userId={(location.state as LocationState)?.userId}
          onSuccess={handle2FASuccess}
          onNavigateLogin={handleNavigateLogin}
        />
      )}
      {mode === "profile" && (
        <ProfileContent
          baseUrl={BASE_BETA_URL}
          onNavigateChangePassword={handleNavigateChangePassword}
          onNavigateSessions={handleNavigateSessions}
          onLogout={handleLogout}
        />
      )}
      {mode === "change-password" && (
        <ChangePasswordContent
          baseUrl={BASE_BETA_URL}
          onSuccess={handleChangePasswordSuccess}
          onCancel={handleNavigateProfile}
        />
      )}
      {mode === "sessions" && (
        <SessionsContent
          baseUrl={BASE_BETA_URL}
          onNavigateProfile={handleNavigateProfile}
        />
      )}
    </>
  );
}
