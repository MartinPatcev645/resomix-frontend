import { AboutHero, AboutOne, AboutTwo, AboutThree, AboutFour, AboutFive } from "@/sections/mobile/index.ts";
import AngleDown from "@/assets/icons/AngleDown.svg";

export function AboutMobile() {
  return (
    <div className="overflow-hidden">
      <AboutHero />
      <img src={AngleDown} aria-label="arrow_down" loading="lazy" draggable={false} alt="arrow_down" className="w-[var(--px-50)] h-[var(--px-50)] w-full self-center my-[var(--px-50)]" />
      <div className="relative z-20 mt-[var(--px-60)]">
        <AboutOne />
        <AboutTwo />
        <AboutThree />
        <AboutFour />
        <AboutFive />
      </div>
    </div>
  );
}
