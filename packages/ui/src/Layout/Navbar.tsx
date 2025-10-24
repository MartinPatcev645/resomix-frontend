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
}

export const Navbar: React.FC<NavbarProps> = ({ logo, mode = 'home', customClass, baseUrl = "https://resomix.com", baseBetaUrl = "https://beta.resomix.com", onProfileClick }) => {
  const { showFeedbackForm } = useFeedbackStore();
  const { isAuthenticated } = useAuthStore();

  return (
    <nav className={`${customClass ? customClass : 'flex justify-between items-center align-center pt-[var(--px-28)] px-[var(--px-65)] z-40 relative'}`} aria-label="Primary">
      <div className="inline-flex justify-center items-center gap-[var(--px-16)]"
        style={{
          color: "var(--color-text-secondary)",
        }}>
        <LinkButton text="About Us" path={`${baseUrl}/about`} className="nav-link" id="navbar-about-link" />
        <LinkButton text="Waitlist" path={`${baseUrl}/waitlist`} className="nav-link" id="navbar-waitlist-link" />
        <LinkButton text="Journal" path={`https://resomix.com/blog`} newTab={true} className="nav-link" id="navbar-journal-link" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pt-[var(--px-28)]">
        {logo}
      </div>
      <div className="flex items-center gap-[var(--px-16)]">
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
          <ProfileIcon 
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" 
            onClick={onProfileClick}
          />
        ) : (
          <ButtonSleek 
            text="Login" 
            href={`${baseBetaUrl}/auth/login`} 
            className="auth-button" 
            id="navbar-login-button"
            customWidth="min-w-[var(--px-80)]"
            onClick={() => {}} // Empty handler for href navigation
          />
        )}
      </div>
    </nav>
  );
};
