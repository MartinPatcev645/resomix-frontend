import React from "react";
import { ButtonHeavyRight, ButtonSleek } from "@resomix/ui";
import { useFeedbackStore } from "@resomix/stores";
import { useAuthStore } from "@resomix/stores";
import CrossSvg from "@/assets/icons/cross.svg";
import RIconsFooter from "@/assets/icons/r_icon_footer.svg";
import MenuSeparator from "@/assets/icons/menu_separator.svg";
import { BASE_LANDING_URL, BASE_BETA_URL } from "@resomix/config";

interface MenuPageProps {
  onClose?: () => void;
}

const MenuPage: React.FC<MenuPageProps> = ({ onClose }) => {
  const { showFeedbackForm } = useFeedbackStore();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="w-screen h-full min-h-screen relative overflow-hidden bg-[var(--color-primary-background)]">
      <div className="absolute inset-0 w-full h-full"></div>
      <div className="flex flex-col justify-between h-full min-h-screen relative z-15 text-[var(--color-primary)]">
        <div className="mt-[var(--px-30)] mr-[var(--px-30)] flex justify-end">
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close menu">
              <img src={CrossSvg} aria-hidden="true" loading="lazy" draggable={false} alt="" className="w-[var(--px-19)] h-[var(--px-19)]" />
            </button>
          ) : (
            <a href={BASE_LANDING_URL} aria-label="Go to Resomix home" className="menu-home-link" id="beta-menu-home-link">
              <img src={CrossSvg} aria-hidden="true" loading="lazy" draggable={false} alt="" className="w-[var(--px-19)] h-[var(--px-19)]" />
            </a>
          )}
        </div>
        <div className="flex flex-col gap-[var(--px-30)] items-center">
          <div className="">
            <a href={BASE_LANDING_URL} aria-label="Resomix home" className="menu-logo-link" id="beta-menu-logo-link">
              <img src={RIconsFooter} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-19)] h-[var(--px-19)]" />
            </a>
          </div>
          <a 
            href={`${BASE_LANDING_URL}/about`}
            className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
            id="beta-menu-about-link"
            aria-label="About Us"
          >
            [About Us]
          </a>
          <button 
            type="button"
            onClick={showFeedbackForm}
            className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
            id="beta-menu-feedback-link"
          >
            [Feedback]
          </button>
          <a 
            href={`${BASE_LANDING_URL}/waitlist`}
            className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
            id="beta-menu-waitlist-link"
            aria-label="Waitlist"
          >
            [Waitlist]
          </a>
          <a href={`${BASE_LANDING_URL}/blog`} aria-label="Resomix blog" target="_blank" rel="noopener noreferrer" className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" id="beta-menu-journal-link">
            [Journal]
          </a>

          {/* Auth section */}
          {isAuthenticated ? (
            <>
              <a 
                href={`${BASE_BETA_URL}/profile`}
                className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
                id="beta-menu-profile-link"
                aria-label="Profile"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `${BASE_BETA_URL}/profile`;
                }}
              >
                [Profile]
              </a>
              <a 
                href={`${BASE_BETA_URL}/library`}
                className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
                id="beta-menu-library-link"
                aria-label="Library"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `${BASE_BETA_URL}/library`;
                }}
              >
                [Library]
              </a>
              <a 
                href={`${BASE_BETA_URL}/analysis`}
                className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
                id="beta-menu-analysis-link"
                aria-label="Analysis"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `${BASE_BETA_URL}/analysis`;
                }}
              >
                [Analysis]
              </a>
              <button 
                type="button"
                onClick={async () => {
                  try {
                    const { logout } = await import("@resomix/api-client");
                    await logout();
                  } catch (error) {
                    console.error("Logout error:", error);
                  } finally {
                    const { useAuthStore } = await import("@resomix/stores");
                    useAuthStore.getState().logout();
                    window.location.href = `${BASE_BETA_URL}/auth/login`;
                  }
                }}
                className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer menu-link" 
                id="beta-menu-logout-button"
              >
                [Logout]
              </button>
            </>
          ) : (
            <ButtonSleek 
              text="Login" 
              href={`${BASE_BETA_URL}/auth/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}
              className="auth-button" 
              id="beta-menu-login-button"
              customWidth="min-w-[var(--px-80)]"
              onClick={() => {}}
            />
          )}
          <div className="">
            <img src={MenuSeparator} aria-hidden="true" loading="lazy" draggable={false} alt="" className="w-[var(--px-4)] h-[var(--px-49)]" />
          </div>
          <div className="w-full flex justify-center">
            <ButtonHeavyRight className="w-[var(--px-276)] cta-button primary" text="Upload Your Track" onClick={() => {
              window.location.href = BASE_BETA_URL
            }} id="beta-menu-upload-button" />
          </div>
        </div>
        <h2 className="text-[length:var(--px-30)] font-normal font-benzin uppercase text-start">
          Join the Resomix<br />
          Universe
        </h2>
      </div>
    </div>
  );
};

export default MenuPage;
