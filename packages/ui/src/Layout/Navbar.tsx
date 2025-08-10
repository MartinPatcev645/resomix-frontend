import React from "react";
import { LinkButton } from "../Buttons/LinkButton";
import { ButtonHeavyRight } from "../Buttons/ButtonHeavyRight";
import { ButtonHeavyLeft } from "../Buttons/ButtonHeavyLeft";
import { ToggleButton } from "../Buttons/ToggleButton";
import { ButtonSleek } from "../Buttons/ButtonSleek";

interface NavbarProps {
  logo?: React.ReactNode;
  mode?: 'home' | 'upload' | 'playlist';
  customClass?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ logo, mode = 'home', customClass }) => (
  <nav className={`${customClass ? customClass : 'flex justify-between items-center align-center pt-[var(--px-28)] px-[var(--px-65)] z-20 relative'}`}>
    <div className="inline-flex justify-center items-center gap-[var(--px-16)]"
      style={{
        color: "var(--color-text-secondary)",
      }}>
      <LinkButton text="About Us" path="/about" />
      <LinkButton text="Contact" path="/contact" />
      <div className="p-[var(--px-8)] w-[var(--px-10)]"></div>
    </div>
    <div>
      {logo}
    </div>
    {mode === 'home' && (
      <ButtonHeavyRight text="Upload Your Track" onClick={() => { }} />
    )}
    {mode === 'upload' && (
      <ButtonHeavyLeft text="Why Resomix?" onClick={() => { }} transparent={true} />
    )}
    {mode === 'playlist' && (
      <div className="flex justify-center items-center">
        <ToggleButton text="Autoplay" customWidth="min-w-[var(--px-120)]" onClick={() => { }} />
        <ButtonSleek text="Feedback" transparent={true} customWidth="min-w-[var(--px-120)]" onClick={() => { }} />
      </div>
    )}
  </nav>
);
