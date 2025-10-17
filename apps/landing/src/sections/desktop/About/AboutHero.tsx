import React, { useRef } from "react";
import XSvg from "@/assets/icons/twitter_x.svg";
import InstaSvg from "@/assets/icons/instagram.svg";
import FbSvg from "@/assets/icons/facebook.svg";
import GradientOne from "@/assets/images/gradient 1.png";
import { IconComp } from "@resomix/ui";
import { FACEBOOK_URL, INSTAGRAM_URL, TWITTER_URL } from "@resomix/config";
import { useTranslation } from 'react-i18next';

const AboutHero: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { t } = useTranslation('common');
  // const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");

  return (
    <div ref={sectionRef} className="relative">
      {/* Hidden SVG defs for clip-path */}
      <svg
        viewBox="0 0 1154 628"
        preserveAspectRatio="none"
        className="absolute inset-0 w-[length:var(--px-1156)] h-[length:var(--px-628)] pointer-events-none z-10"
      >
        <defs>
          <clipPath id="heroClip" clipPathUnits="objectBoundingBox">
            <path transform="scale(0.0008680556,0.0015923567)" d="M279.222 1.07413H0.333008L0.333336 628H279.222L347.74 585.889H779.963L848.481 628H1152L1152 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z" />
          </clipPath>
        </defs>

        {/* stroke outline */}
        <path
          d="M279.222 1.07413H0.333008L0.333336 628H279.222L347.74 585.889H779.963L848.481 628H1152L1152 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z"
          stroke="white"
          strokeOpacity="1"
          strokeWidth="1"
          strokeDasharray="0.74 0.74"
          fill="none"
        />
      </svg>

      {/* Clip content inside shape */}
      <div
        className="relative w-[var(--px-1156)] h-[var(--px-628)] mx-auto z-20"
        style={{
          clipPath: "url(#heroClip)",
          WebkitClipPath: "url(#heroClip)"
        }}
      >
        {/* Remains background animation */}
        <div className="absolute inset-0 flex justify-center items-center w-full h-full overflow-clip">
          {/* {isVisible && <Remains />} */}
          <img src={GradientOne} draggable={false} aria-hidden="true" loading="lazy" className="w-[var(--px-1100)] h-[var(--px-750)] mt-[var(--px-6)]" alt="Gradient" />
        </div>

        {/* Overlay content */}
        <div className="absolute inset-0 flex flex-col justify-center w-full h-full select-none py-auto z-15">
          <div className="text-[length:var(--px-59)] font-helvetica uppercase leading-[var(--px-51)]">{t('about.about_hero.discovery_engine')}</div>
          <div className="text-[length:var(--px-59)] font-helvetica uppercase leading-[var(--px-51)] text-right">{t('about.about_hero.for_djs_who_feel')}</div>
        </div>
        <div className="absolute inset-0 flex flex-col justify-end items-end w-full h-full select-none py-auto z-15">
          <div className="flex gap-[var(--px-4)] mr-[var(--px-8)] mb-[var(--px-8)] relative z-15">
            <IconComp
              svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" draggable={false} loading="lazy" src={FbSvg} alt="" aria-hidden="true" />}
              className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)] social-icon"
              padding=""
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              ariaLabel="Visit Resomix on Facebook"
              id="about-hero-facebook-icon"
            />
            <IconComp
              svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" draggable={false} loading="lazy" src={InstaSvg} alt="" aria-hidden="true" />}
              className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)] social-icon"
              padding=""
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              ariaLabel="Visit Resomix on Instagram"
              id="about-hero-instagram-icon"
            />
            <IconComp
              svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" draggable={false} loading="lazy" src={XSvg} alt="" aria-hidden="true" />}
              className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)] social-icon"
              padding=""
              href={TWITTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              ariaLabel="Visit Resomix on X (Twitter)"
              id="about-hero-twitter-icon"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutHero;
