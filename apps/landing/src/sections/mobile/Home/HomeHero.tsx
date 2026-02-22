import React from "react";
import { IconComp, ButtonHeavyRight } from "@resomix/ui";
import XSvg from "@/assets/icons/twitter_x.svg";
import InstaSvg from "@/assets/icons/instagram.svg";
import FbSvg from "@/assets/icons/facebook.svg";
import SoundWaves from "@/assets/icons/sound_waves.svg";
import ArrowSmallDown from "@/assets/icons/arrow_small_down.svg";
import { BASE_BETA_URL, FACEBOOK_URL, INSTAGRAM_URL, TWITTER_URL } from "@resomix/config";

const HomeHero: React.FC = () => (
  <div className="relative">
    {/* Hidden SVG defs for clip-path */}
    <svg
      viewBox="0 0 360 1059"
      preserveAspectRatio="none"
      className="absolute inset-0 w-[var(--px-355)] h-[length:var(--px-1059)] pointer-events-none z-10"
    >
      <defs>
        <clipPath id="heroClip" clipPathUnits="objectBoundingBox">
          <path transform="scale(0.0027777777,0.00094428706)" d="M1 1L0.5 1057.5L102 1012.5H172.327V983H323L358 1011V1H1Z" />
        </clipPath>
      </defs>

      {/* stroke outline */}
      <path
        d="M1 1L0.5 1057.5L102 1012.5H172.327V983H323L358 1011V1H1Z"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="1"
        strokeDasharray="0.74 0.74"
        fill="none"
      />
    </svg>

    {/* Clip content inside shape */}
    <div
      className="relative w-[var(--px-355)] h-[var(--px-1059)] z-20 -mt-[var(--px-20)]"
      style={{
        clipPath: "url(#heroClip)",
        WebkitClipPath: "url(#heroClip)"
      }}
    >
      {/* Overlay content */}
      <div className="absolute inset-0 flex flex-col items-end justify-start w-full h-full select-none -mt-[var(--px-20)]">
        <div className="flex flex-col text-start mt-[var(--px-200)] mb-[var(--px-70)] w-full relative z-15">
          <div className="justify-start text-[length:var(--px-40)] font-benzin uppercase leading-[var(--px-52)]" style={{ textShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>Resomix<br />— Hear the<br />Invisible </div>
          <div className="justify-start text-[length:var(--px-18)] font-light font-helvetica uppercase mt-[var(--px-12)]" style={{ textShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>A sonic analysis platform that<br />searches by sound and feeling,<br />not trends</div>
          <img className="w-[var(--px-35)] h-[var(--px-35)] mt-[var(--px-12)]" aria-hidden="true" loading="lazy" draggable={false} style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.6))" }} src={ArrowSmallDown} alt="Arrow Small Down" />
        </div>
        <div className="w-full flex justify-center items-center mb-[var(--px-20)]">
          <ButtonHeavyRight text="Start Your Sonic Discovery" onClick={() => {
            window.location.href = BASE_BETA_URL
          }} className="cta-button primary" id="home-hero-upload-button" />
        </div>
        <div className="flex gap-[var(--px-15)] mx-auto relative z-15 my-[var(--px-50)]">
          <IconComp
            svg={<img className="w-[var(--px-30)] h-[var(--px-30)]" loading="lazy" draggable={false} src={FbSvg} alt="" aria-hidden="true" />}
            className="w-[var(--px-30)] h-[var(--px-30)] px-[var(--px-5)] social-icon"
            padding=""
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            ariaLabel="Visit Resomix on Facebook"
            id="home-hero-facebook-icon"
          />
          <IconComp
            svg={<img className="w-[var(--px-30)] h-[var(--px-30)]" loading="lazy" draggable={false} src={InstaSvg} alt="" aria-hidden="true" />}
            className="w-[var(--px-30)] h-[var(--px-30)] px-[var(--px-5)] social-icon"
            padding=""
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            ariaLabel="Visit Resomix on Instagram"
            id="home-hero-instagram-icon"
          />
          <IconComp
            svg={<img className="w-[var(--px-30)] h-[var(--px-30)]" loading="lazy" draggable={false} src={XSvg} alt="" aria-hidden="true" />}
            className="w-[var(--px-30)] h-[var(--px-30)] px-[var(--px-5)] social-icon"
            padding=""
            href={TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            ariaLabel="Visit Resomix on X (Twitter)"
            id="home-hero-twitter-icon"
          />
        </div>
        {/* Text below the SVG clip path */}
        <div className='flex justify-center items-center gap-[var(--px-8)] relative z-15 w-full min-h-[var(--px-100)] mb-[var(--px-40)]'>
          <div className="text-right justify-start text-[length:var(--px-20)] font-extralight font-helvetica uppercase leading-[var(--px-20)]">Unbounded by trends<br />built for emotional<br />resonance</div>
          <img src={SoundWaves} draggable={false} aria-hidden="true" loading="lazy" className="w-[var(--px-41)] h-[var(--px-50)]" alt="Sound Waves" />
        </div>
      </div>
    </div>
  </div>
);

export default HomeHero;
