import React from "react";
import { ButtonHeavyRight } from "@resomix/ui";
// import { StaticNoise, ButtonHeavyRight } from "@resomix/ui";
import CrossSvg from "@/assets/icons/cross.svg";
import RIconsFooter from "@/assets/icons/r_icon_footer.svg";
import MenuSeparator from "@/assets/icons/menu_separator.svg";

interface MenuPageProps {
  onClose?: () => void;
}

const MenuPage: React.FC<MenuPageProps> = ({ onClose }) => (
  <div className="w-screen h-full min-h-screen relative overflow-hidden">
    {/* Background static noise */}
    {/* <StaticNoise color="#323233" zIndex={0} /> */}
    <div className="absolute inset-0 w-full h-full bg-[var(--color-secondary)]"></div>
    <div className="flex flex-col justify-between h-full min-h-screen relative z-15 text-[var(--color-primary)]">
      <div className="mt-[var(--px-30)] mr-[var(--px-30)] flex justify-end">
        {onClose ? (
          <button onClick={onClose} aria-label="Close menu">
            <img src={CrossSvg} alt="Cross" className="w-[var(--px-19)] h-[var(--px-19)]" />
          </button>
        ) : (
          <a href="/">
            <img src={CrossSvg} alt="Cross" className="w-[var(--px-19)] h-[var(--px-19)]" />
          </a>
        )}
      </div>
      <div className="flex flex-col gap-[var(--px-30)] items-center">
        <div className="">
          <a href="/">
            <img src={RIconsFooter} alt="RIconsFooter" className="w-[var(--px-19)] h-[var(--px-19)]" />
          </a>
        </div>
        <div className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center">
          [About Us]
        </div>
        <div className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center">
          [Feedback]
        </div>
        <div className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center">
          [Contact]
        </div>
        <div className="">
          <img src={MenuSeparator} alt="MenuSeparator" className="w-[var(--px-4)] h-[var(--px-49)]" />
        </div>
        <div className="w-full">
          <ButtonHeavyRight className="w-[var(--px-276)]" text="Upload Your Track" onClick={() => { }} />
        </div>
      </div>
      <div className="text-[length:var(--px-30)] font-normal font-benzin uppercase text-start">
        Join the Resomix<br />
        Universe
      </div>
    </div>
  </div>
);

export default MenuPage;
