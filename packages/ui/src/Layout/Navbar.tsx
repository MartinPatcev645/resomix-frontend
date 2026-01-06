import React from "react";
import { LinkButton } from "../Buttons/LinkButton";
import { ButtonHeavyRight } from "../Buttons/ButtonHeavyRight";
import { ButtonHeavyLeft } from "../Buttons/ButtonHeavyLeft";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { ProfileIcon } from "../Vectors/ProfileIcon";
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
}

export const Navbar: React.FC<NavbarProps> = ({ logo, mode = 'home', customClass, baseUrl = "https://resomix.com", baseBetaUrl = "https://beta.resomix.com", onProfileClick, currentPath, onNavigate }) => {
  const { showFeedbackForm } = useFeedbackStore();
  const { isAuthenticated } = useAuthStore();

  return (
    <nav className={`${customClass ? customClass : 'flex justify-between items-center align-center pt-[var(--px-28)] px-[var(--px-65)] z-40 relative'}`} aria-label="Primary">
      <div className="inline-flex justify-center items-center gap-[var(--px-16)]"
        style={{
          color: "var(--color-text-secondary)",
        }}>
        <LinkButton text="About Us" path={`${baseUrl}/about`} className="nav-link" id="navbar-about-link" onClick={() => onNavigate?.(`${baseUrl}/about`)} />
        <LinkButton text="Waitlist" path={`${baseUrl}/waitlist`} className="nav-link" id="navbar-waitlist-link" onClick={() => onNavigate?.(`${baseUrl}/waitlist`)} />
        <LinkButton text="Journal" path={`https://resomix.com/blog`} newTab={true} className="nav-link" id="navbar-journal-link" />
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
          <a href={`${baseBetaUrl}/profile`}
            aria-label="Profile"
            className="cursor-pointer"
          >
            <ProfileIcon
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
              customWidth="30"
              customHeight="30"
              onClick={(e) => {
                if (onProfileClick) {
                  e.preventDefault();
                  onProfileClick();
                } else if (onNavigate) {
                  e.preventDefault();
                  onNavigate('/profile');
                }
              }}
            />
          </a>
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
