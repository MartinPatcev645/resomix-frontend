import React from "react";
// import { LogoHeader } from "../Logo/LogoHeader";
import { LinkButton } from "../Buttons/LinkButton";
import { ButtonHeavyRight } from "../Buttons/ButtonHeavyRight";

interface NavbarProps {
  logo?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({ logo }) => (
  <nav className='flex justify-between items-center align-center pt-2 mx-12 z-20 relative'>
    <div className="inline-flex justify-center items-center gap-4"
      style={{
        color: "var(--color-text-secondary)",
      }}>
      <LinkButton text="About Us" path="/about" />
      <LinkButton text="Playlist" path="/playlist" />
      <LinkButton text="Contact" path="/contact" />
    </div>
    <div>
      {logo}
    </div>
    <ButtonHeavyRight text="Upload Your Track" onClick={() => { }} />

  </nav>
);
