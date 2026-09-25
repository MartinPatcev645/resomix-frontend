import React, { useCallback } from "react";
import { BLOG_URL } from "@resomix/config";
import { LinkButton } from "../Buttons/LinkButton";
import { ButtonHeavyRight } from "../Buttons/ButtonHeavyRight";
import { ButtonHeavyLeft } from "../Buttons/ButtonHeavyLeft";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { ProfileIcon } from "../Vectors/ProfileIcon";
import { ProfileDropdown } from "../Elements/ProfileDropdown";
import { useFeedbackStore, useAuthStore } from "@resomix/stores";

interface NavbarProps {
  logo?: React.ReactNode;
  mode?: string;
  customClass?: string;
  baseUrl?: string;
  baseBetaUrl?: string;
  onProfileClick?: () => void;
  onNavigate?: (path: string) => void;
  currentPath?: string; // Current page path for redirect after login
  /** Show the app-only profile links (Library, Analysis). Default true (the web app). The marketing
   *  site (resomix.com) passes false so its dropdown only shows Profile + Logout — app features live
   *  on the app (beta.resomix.com), which Profile links to. */
  showAppLinks?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ logo, mode = 'home', customClass, baseUrl = "https://resomix.com", baseBetaUrl = "https://beta.resomix.com", onProfileClick, currentPath, onNavigate, showAppLinks = true }) => {
  const { showFeedbackForm } = useFeedbackStore();
  const { isAuthenticated } = useAuthStore();

  const handleLogout = useCallback(async () => {
    try {
      const { logout } = await import("@resomix/api-client");
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Always clear local state, even if server call fails
      useAuthStore.getState().logout();
      onNavigate?.("/auth/login");
    }
  }, [onNavigate]);

  const profileMenuItems = [
    {
      label: "Profile",
      id: "navbar-profile-menu-item",
      // In the app onProfileClick routes to /profile; on the marketing site it links to the app.
      href: onProfileClick ? "/profile" : `${baseBetaUrl}/profile`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path fillRule="evenodd" clipRule="evenodd" d="M16.5 7.063C16.5 10.258 14.57 13 12 13c-2.572 0-4.5-2.742-4.5-5.938C7.5 3.868 9.16 2 12 2s4.5 1.867 4.5 5.063zM4.102 20.142C4.487 20.6 6.145 22 12 22c5.855 0 7.512-1.4 7.898-1.857a.416.416 0 0 0 .09-.317C19.9 18.944 19.106 15 12 15s-7.9 3.944-7.989 4.826a.416.416 0 0 0 .091.317z" fill="currentColor" />
        </svg>
      ),
      onClick: () => {
        if (onProfileClick) {
          onProfileClick();
        } else {
          onNavigate?.(`${baseBetaUrl}/profile`);
        }
      },
    },
    // App-only links (Library, Analysis) — hidden on the marketing site (showAppLinks=false).
    ...(showAppLinks ? [
    {
      label: "Library",
      id: "navbar-library-menu-item",
      href: `${baseBetaUrl}/library`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M4 4h2v16H4V4zm5 0h2v16H9V4zm4.5 0h2l3.5 16h-2l-3.5-16z" fill="currentColor" />
        </svg>
      ),
      onClick: () => onNavigate?.(`${baseBetaUrl}/library`),
    },
    {
      label: "Track Intelligence",
      id: "navbar-analysis-menu-item",
      href: `${baseBetaUrl}/track-intelligence`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M3 3v18h18M7 17V13m4 4V9m4 8v-6m4 6V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      onClick: () => onNavigate?.(`${baseBetaUrl}/track-intelligence`),
    },
    ] : []),
    {
      label: "Logout",
      id: "navbar-logout-menu-item",
      separated: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      onClick: handleLogout,
    },
  ];

  return (
    <nav className={`${customClass ? customClass : 'flex justify-between items-center align-center pt-[var(--px-28)] px-[var(--px-65)] z-40 relative'}`} aria-label="Primary">
      <div className="inline-flex justify-center items-center gap-[var(--px-16)]"
        style={{
          color: "var(--color-text-secondary)",
        }}>
        <LinkButton text="About Us" path={`${baseUrl}/about`} className="nav-link" id="navbar-about-link" onClick={() => onNavigate?.(`${baseUrl}/about`)} />
        <LinkButton text="Waitlist" path={`${baseUrl}/waitlist`} className="nav-link" id="navbar-waitlist-link" onClick={() => onNavigate?.(`${baseUrl}/waitlist`)} />
        <LinkButton text="Journal" path={BLOG_URL} newTab={true} className="nav-link" id="navbar-journal-link" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pt-[var(--px-28)]">
        {logo}
      </div>
      <div className={`flex items-center ${isAuthenticated ? 'gap-[var(--px-30)] mr-[var(--px-20)]' : 'gap-[var(--px-16)]'}`} >
        {/* Mode-specific buttons */}
        {(mode === 'home' || mode === 'contact' || mode === 'error' || mode === '404') && (
          <ButtonHeavyRight text="Upload Your Track" href={baseBetaUrl} className="cta-button primary" id="navbar-upload-button" />
        )}
        {(mode === 'upload' || mode === 'terms' || mode === 'privacy') && (
          <ButtonHeavyLeft text="Why Resomix?" href={`${baseUrl}/about`} transparent={true} link_arrow={true} className="cta-button secondary" id="navbar-why-resomix-button" />
        )}
        {mode === 'playlist' && (
          <ButtonSleek text="Feedback" transparent={true} customWidth="min-w-[var(--px-120)]" onClick={showFeedbackForm} className="feedback-button" id="navbar-feedback-button" />
        )}

        {/* Auth button - always on the right */}
        {isAuthenticated ? (
          <ProfileDropdown
            align="right"
            items={profileMenuItems}
            trigger={
              <ProfileIcon
                className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                customWidth="30"
                customHeight="30"
              />
            }
          />
        ) : (
          <ButtonSleek
            text="Login"
            href={`${baseBetaUrl}/auth/login${currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`}
            className="auth-button"
            id="navbar-login-button"
            customWidth="min-w-[var(--px-80)]"
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate(`${baseBetaUrl}/auth/login${currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`);
              }
            }}
          />
        )}
      </div>
    </nav>
  );
};
