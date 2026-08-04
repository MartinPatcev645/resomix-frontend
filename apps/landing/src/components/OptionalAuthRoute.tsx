import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "@resomix/stores";
import { useHydrated, useIsomorphicLayoutEffect } from "@resomix/hooks";
import { AuthStatusBanner, DemoStageBanner, StatusMessage } from "@resomix/ui";
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
  /* This wrapper's own `data-authenticated` attribute is the only thing here that reads auth during
     render — every banner below starts hidden and is switched on by an effect. The build emits
     `false`, so the first client render must too, or hydration mismatches on the attribute and React
     re-renders the whole page client-side. See useHydrated. */
  const hydrated = useHydrated();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  /*
   * Starts SHOWN, and is hidden again only if this visitor dismissed it.
   *
   * It used to start hidden and be switched on by an effect, which meant the banner appeared after
   * the page had already painted and pushed everything below it down — a layout shift on every
   * single load. Now the prerendered HTML contains the banner, the first client render agrees with
   * it, and the rare dismissed visitor has it removed in the layout effect below, before paint.
   */
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const [showStatusMessage, setShowStatusMessage] = useState(false);
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    // Check if banner was previously dismissed (stored in localStorage)
    const dismissed = localStorage.getItem("email_verification_banner_dismissed");
    setBannerDismissed(dismissed === "true");
  }, []);

  useIsomorphicLayoutEffect(() => {
    try {
      if (localStorage.getItem("demo_stage_notice_dismissed") === "true") setShowDemoBanner(false);
    } catch {
      /* storage blocked — keeping the banner shown is the safe default */
    }
  }, []);

  useEffect(() => {
    // Clear dismissed flag if email verification status changes to verified
    if (user?.is_email_verified) {
      localStorage.removeItem("email_verification_banner_dismissed");
      setBannerDismissed(false);
    }
  }, [user?.is_email_verified]);

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
        const result = await resendVerification(user.email);
        
        if (result.success) {
          setStatusType("success");
          setStatusMessage("Verification email sent! Please check your inbox.");
          setShowStatusMessage(true);
        } else {
          // API returned error (e.g., "Email already verified")
          const errorResult = result as { success: false; error: string };
          setStatusType("error");
          setStatusMessage(errorResult.error || "Failed to send verification email.");
          setShowStatusMessage(true);
          
          // If email is already verified, hide the banner
          if (errorResult.error?.includes("already verified")) {
            handleDismiss();
          }
        }
      } catch (error) {
        console.error("Failed to resend verification:", error);
        setStatusType("error");
        setStatusMessage("Failed to send verification email. Please try again.");
        setShowStatusMessage(true);
      }
    }
  };

  const handleDismiss = () => {
    setBannerDismissed(true);
    localStorage.setItem("email_verification_banner_dismissed", "true");
    setShowBanner(false);
  };

  const handleDemoDismiss = () => {
    localStorage.setItem("demo_stage_notice_dismissed", "true");
    setShowDemoBanner(false);
  };

  return (
    <div data-authenticated={hydrated && isAuthenticated}>
      {showDemoBanner && (
        <DemoStageBanner onDismiss={handleDemoDismiss} />
      )}
      {showBanner && (
        <AuthStatusBanner
          onResendVerification={handleResendVerification}
          onDismiss={handleDismiss}
        />
      )}
      {children}
      
      <StatusMessage
        isOpen={showStatusMessage}
        onClose={() => setShowStatusMessage(false)}
        status={statusType}
        message={statusMessage}
      />
    </div>
  );
};

