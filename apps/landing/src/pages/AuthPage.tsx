import {
  InfoPageLayout,
  MobileNavbar,
  Navbar,
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
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { useState } from "react";
import { MenuPage } from "./index.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import { useNavigate, useLocation } from "react-router-dom";

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation handlers
  const handleNavigateLogin = () => navigate("/auth/login");
  const handleNavigateRegister = () => navigate("/auth/register");
  const handleNavigateForgotPassword = () => navigate("/auth/forgot-password");
  const handleNavigateProfile = () => navigate("/profile");
  const handleNavigateSessions = () => navigate("/sessions");
  const handleNavigateChangePassword = () => navigate("/change-password");

  // Success handlers
  const handleLoginSuccess = () => {
    // Redirect to intended page or home
    const from = (location.state as any)?.from || "/";
    navigate(from, { replace: true });
  };

  const handleRegisterSuccess = () => {
    // Show email verification page
    navigate("/auth/verify-email?mode=sent", { replace: true });
  };

  const handleVerifyEmailSuccess = () => {
    navigate("/auth/login", { replace: true });
  };

  const handleForgotPasswordSuccess = () => {
    // Stay on the same page to show success message
  };

  const handleResetPasswordSuccess = () => {
    navigate("/auth/login", { replace: true });
  };

  const handle2FASuccess = () => {
    const from = (location.state as any)?.from || "/";
    navigate(from, { replace: true });
  };

  const handleNavigate2FA = (userId: number) => {
    navigate("/auth/verify-2fa", { state: { userId }, replace: true });
  };

  const handleChangePasswordSuccess = () => {
    navigate("/profile", { replace: true });
  };

  const handleLogout = () => {
    navigate("/auth/login", { replace: true });
  };

  // Navbar component (same pattern as InfoPage)
  const navbar = (
    <>
      <div className="hidden lg:block">
        <Navbar
          logo={
            <a
              href={BASE_LANDING_URL}
              aria-label="Resomix home"
              className="cursor-default"
            >
              <LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
            </a>
          }
          mode={mode}
          baseUrl={BASE_LANDING_URL}
          baseBetaUrl={BASE_BETA_URL}
          customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
          onProfileClick={() => navigate('/profile')}
        />
      </div>
      <div className="block lg:hidden">
        <MobileNavbar
          logo={
            <a href={BASE_LANDING_URL} aria-label="Resomix home" className="cursor-default">
              <LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
            </a>
          }
          menuIcon={
            <button
              name="Open menu"
              type="button"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
              className="cursor-default"
            >
              <MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
            </button>
          }
          customClass="flex justify-between items-center align-center z-50 relative"
        />
      </div>
    </>
  );

  return (
    <>
      <InfoPageLayout
        navbar={navbar}
        baseUrl={BASE_LANDING_URL}
        LogoRFooter={
          <LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />
        }
        mode={mode}
      >
        {mode === "login" && (
          <LoginContent
            baseUrl={BASE_BETA_URL}
            onLoginSuccess={handleLoginSuccess}
            onNavigateRegister={handleNavigateRegister}
            onNavigateForgotPassword={handleNavigateForgotPassword}
            onNavigate2FA={handleNavigate2FA}
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
            onSuccess={handleVerifyEmailSuccess}
            onNavigateLogin={handleNavigateLogin}
          />
        )}
        {mode === "verify-2fa" && (
          <Verify2FAContent
            baseUrl={BASE_BETA_URL}
            userId={(location.state as any)?.userId}
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
      </InfoPageLayout>

      {/* Menu Overlay - same as InfoPage */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100]">
          <MenuPage onClose={() => setIsMenuOpen(false)} />
        </div>
      )}
    </>
  );
}

