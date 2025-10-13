import React, { useRef } from "react";
import { IconComp } from "@resomix/ui";
import ArrowDownRightSvg from "@/assets/icons/arrow_down_right.svg";
import XSvg from "@/assets/icons/twitter_x.svg";
import InstaSvg from "@/assets/icons/instagram.svg";
import FbSvg from "@/assets/icons/facebook.svg";
import GradientOne from "@/assets/images/gradient 1.png";
import { FACEBOOK_URL, INSTAGRAM_URL, TWITTER_URL } from "@resomix/config";

const AboutHero: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={sectionRef} className="relative z-20 flex flex-col items-center justify-between gap-[var(--px-40)] min-h-[var(--px-670)] h-[var(--px-670)]">
      <div className="absolute -left-[var(--px-130)] top-[var(--px-28)] w-[var(--px-605)] h-[var(--px-489)]">
        <img src={GradientOne} draggable={false} className="w-full h-full mt-[var(--px-6)]" alt="Gradient" />
      </div>
      <div></div>
      <div className="flex flex-col items-start justify-center w-full text-[length:var(--px-40)] font-helvetica leading-[var(--px-40)] font-bold uppercase my-[var(--px-2)] ml-[var(--px-30)] z-20">
        <div className="">
          A Discovery<br />Engine
        </div>
        <div className="flex items-center gap-[var(--px-4)]">
          <div className="">
            For DJs
          </div>
          <img src={ArrowDownRightSvg} draggable={false} alt="arrow_down_right" className="w-[var(--px-29)] h-[var(--px-29)] transform rotate-90" />
        </div>
        <div className="">
          Who Feel<br />The Music
        </div>
      </div>
      <div className="flex gap-[var(--px-15)] relative z-15">
        <IconComp
          svg={<img className="w-[var(--px-23)] h-[var(--px-23)]"  draggable={false} src={FbSvg} alt="Fb" />}
          className="w-[var(--px-30)] h-[var(--px-30)] px-[var(--px-5)] social-icon"
          padding=""
          onClick={() => window.open(FACEBOOK_URL, "_blank")}
          id="about-hero-facebook-icon"
        />
        <IconComp
          svg={<img className="w-[var(--px-30)] h-[var(--px-30)]" draggable={false} src={InstaSvg} alt="Insta" />}
          className="w-[var(--px-23)] h-[var(--px-23)] px-[var(--px-5)] social-icon"
          padding=""
          onClick={() => window.open(INSTAGRAM_URL, "_blank")}
          id="about-hero-instagram-icon"
        />
        <IconComp
          svg={<img className="w-[var(--px-30)] h-[var(--px-30)]" draggable={false} src={XSvg} alt="X" />}
          className="w-[var(--px-23)] h-[var(--px-23)] px-[var(--px-5)] social-icon"
          padding=""
          onClick={() => window.open(TWITTER_URL, "_blank")}
          id="about-hero-twitter-icon"
        />
      </div>
    </div>
  );
};

export default AboutHero;
