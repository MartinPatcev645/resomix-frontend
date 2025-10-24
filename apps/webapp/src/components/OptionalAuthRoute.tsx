import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "@resomix/stores";
import { AuthStatusBanner } from "@resomix/ui";
import { resendVerification } from "@resomix/api-client";

interface OptionalAuthRouteProps {
  children: ReactNode;
}

/**
 * Optional Auth Route Wrapper
 * Works with or without authentication
 * Shows email verification banner if user is logged in but email not verified
 */
export const OptionalAuthRoute = ({ children }: OptionalAuthRouteProps) => {
  const { isAuthenticated, user } = useAuthStore();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if banner was previously dismissed (stored in localStorage)
    const dismissed = localStorage.getItem("email_verification_banner_dismissed");
    setBannerDismissed(dismissed === "true");
  }, []);

  useEffect(() => {
    // Show banner if authenticated, email not verified, and not dismissed
    setShowBanner(
      isAuthenticated &&
        user !== null &&
        !user.is_email_verified &&
        !bannerDismissed
    );
  }, [isAuthenticated, user, bannerDismissed]);

  const handleResendVerification = async () => {
    if (user?.email) {
      try {
        await resendVerification(user.email);
        alert("Verification email sent! Please check your inbox.");
      } catch (error) {
        console.error("Failed to resend verification:", error);
        alert("Failed to send verification email. Please try again.");
      }
    }
  };

  const handleDismiss = () => {
    setBannerDismissed(true);
    localStorage.setItem("email_verification_banner_dismissed", "true");
    setShowBanner(false);
  };

  return (
    <div data-authenticated={isAuthenticated}>
      {showBanner && (
        <AuthStatusBanner
          onResendVerification={handleResendVerification}
          onDismiss={handleDismiss}
        />
      )}
      {children}
    </div>
  );
};

