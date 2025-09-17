import React from "react";
import { LinkButton } from "../Buttons/LinkButton";
import { ButtonHeavyRight } from "../Buttons/ButtonHeavyRight";
import { ButtonHeavyLeft } from "../Buttons/ButtonHeavyLeft";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { useFeedbackStore } from "@resomix/stores";

interface NavbarProps {
  logo?: React.ReactNode;
  mode?: string;
  customClass?: string;
  baseUrl?: string;
  baseBetaUrl?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ logo, mode = 'home', customClass, baseUrl = "https://resomix.com", baseBetaUrl = "https://beta.resomix.com" }) => {
  const { showFeedbackForm } = useFeedbackStore();

  return (
    <nav className={`${customClass ? customClass : 'flex justify-between items-center align-center pt-[var(--px-28)] px-[var(--px-65)] z-20 relative'}`}>
      <div className="inline-flex justify-center items-center gap-[var(--px-16)]"
        style={{
          color: "var(--color-text-secondary)",
        }}>
        <LinkButton text="About Us" path={`${baseUrl}/about`} />
        <LinkButton text="Contact" path={`${baseUrl}/contact`} />
        <div className="p-[var(--px-8)] w-[var(--px-10)]"></div>
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pt-[var(--px-28)]">
        {logo}
      </div>
      {(mode === 'home' || mode === 'contact' || mode === 'error' || mode === '404') && (
        <ButtonHeavyRight text="Upload Your Track" onClick={() => {
          window.location.href = baseBetaUrl
        }} />
      )}
      {(mode === 'upload' || mode === 'terms' || mode === 'privacy') && (
        <ButtonHeavyLeft text="Why Resomix?" onClick={() => {
          window.location.href = `${baseUrl}/about`
        }} transparent={true} link_arrow={true} />
      )}
      {mode === 'playlist' && (
        <div className="flex justify-center items-center">
          <ButtonSleek text="Feedback" transparent={true} customWidth="min-w-[var(--px-120)]" onClick={showFeedbackForm} />
        </div>
      )}
    </nav>
  );
};
