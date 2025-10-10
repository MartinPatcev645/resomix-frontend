import React from "react";
import { ButtonHeavyRight } from "@resomix/ui";
import { useFeedbackStore } from "@resomix/stores";
import CrossSvg from "@/assets/icons/cross.svg";
import RIconsFooter from "@/assets/icons/r_icon_footer.svg";
import MenuSeparator from "@/assets/icons/menu_separator.svg";
import { BASE_LANDING_URL, BASE_BETA_URL } from "@resomix/config";

interface MenuPageProps {
  onClose?: () => void;
}

const MenuPage: React.FC<MenuPageProps> = ({ onClose }) => {
  const { showFeedbackForm } = useFeedbackStore();

  return (
    <div className="w-screen h-full min-h-screen relative overflow-hidden bg-[var(--color-primary-background)]">
      <div className="absolute inset-0 w-full h-full"></div>
      <div className="flex flex-col justify-between h-full min-h-screen relative z-15 text-[var(--color-primary)]">
        <div className="mt-[var(--px-30)] mr-[var(--px-30)] flex justify-end">
          {onClose ? (
            <button onClick={onClose} aria-label="Close menu">
              <img src={CrossSvg} draggable={false} alt="Cross" className="w-[var(--px-19)] h-[var(--px-19)]" />
            </button>
          ) : (
            <a href={BASE_LANDING_URL}>
              <img src={CrossSvg} draggable={false} alt="Cross" className="w-[var(--px-19)] h-[var(--px-19)]" />
            </a>
          )}
        </div>
        <div className="flex flex-col gap-[var(--px-30)] items-center">
          <div className="">
            <a href={BASE_LANDING_URL}>
              <img src={RIconsFooter} draggable={false} alt="RIconsFooter" className="w-[var(--px-19)] h-[var(--px-19)]" />
            </a>
          </div>
          <div onClick={() => {
            window.location.href = `${BASE_LANDING_URL}/about`
          }} className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer">
            [About Us]
          </div>
          <div onClick={showFeedbackForm} className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer">
            [Feedback]
          </div>
          <div onClick={() => {
            window.location.href = `${BASE_LANDING_URL}/waitlist`
          }} className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer">
            [Waitlist]
          </div>
          <a href={`https://resomix.com/blog`} target="_blank" rel="noopener noreferrer" className="text-[length:var(--px-16)] font-semibold font-helvetica uppercase text-center cursor-pointer">
            [Journal]
          </a>
          <div className="">
            <img src={MenuSeparator} draggable={false} alt="MenuSeparator" className="w-[var(--px-4)] h-[var(--px-49)]" />
          </div>
          <div className="w-full">
            <ButtonHeavyRight className="w-[var(--px-276)]" text="Upload Your Track" onClick={() => {
              window.location.href = BASE_BETA_URL
            }} />
          </div>
        </div>
        <div className="text-[length:var(--px-30)] font-normal font-benzin uppercase text-start">
          Join the Resomix<br />
          Universe
        </div>
      </div>
    </div>
  );
};

export default MenuPage;
