import React from "react";
import { LinkButton } from "../Buttons/LinkButton";
import { ButtonHeavyRight } from "../Buttons/ButtonHeavyRight";
import { ButtonHeavyLeft } from "../Buttons/ButtonHeavyLeft";
import { ToggleButton } from "../Buttons/ToggleButton";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { usePlayerStore } from "@resomix/stores";

interface NavbarProps {
  logo?: React.ReactNode;
  mode?: string;
  customClass?: string;
  baseUrl?: string;
  baseBetaUrl?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ logo, mode = 'home', customClass, baseUrl = "https://resomix.com", baseBetaUrl = "https://beta.resomix.com" }) => {
  const { autoplay, setAutoplay } = usePlayerStore();

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
      <div>
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
          <ToggleButton
            text="Autoplay"
            customWidth="min-w-[var(--px-120)]"
            isOn={autoplay}
            onToggle={setAutoplay}
          />
          <ButtonSleek text="Feedback" transparent={true} customWidth="min-w-[var(--px-120)]" onClick={() => {
            window.location.href = `${baseUrl}/feedback`
          }} />
        </div>
      )}
    </nav>
  );
};
