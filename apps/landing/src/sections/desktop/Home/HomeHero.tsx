import React, { useRef } from "react";
import { IconComp, ButtonHeavyRight } from "@resomix/ui";
// import { useOnScreen } from "@resomix/hooks";
// import { BackgroundNoise } from "@/components/index.ts";
import XSvg from "@/assets/icons/twitter_x.svg";
import InstaSvg from "@/assets/icons/instagram.svg";
import FbSvg from "@/assets/icons/facebook.svg";
import SoundWaves from "@/assets/icons/sound_waves.svg";
import ArrowSmallDown from "@/assets/icons/arrow_small_down.svg";
import { BASE_BETA_URL, FACEBOOK_URL, INSTAGRAM_URL, TWITTER_URL } from "@resomix/config";

const HomeHero: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");

  return (
    <div ref={sectionRef} className="relative">
      {/* Hidden SVG defs for clip-path */}
      <svg
        viewBox="0 0 1152 628"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-[length:var(--px-628)] pointer-events-none z-10"
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
          strokeOpacity="0.7"
          strokeWidth="1"
          strokeDasharray="0.74 0.74"
          fill="none"
        />
      </svg>

      {/* Clip content inside shape */}
      <div
        className="relative w-full h-[var(--px-628)] z-20"
        style={{
          clipPath: "url(#heroClip)",
          WebkitClipPath: "url(#heroClip)"
        }}
      >
        {/* Background noise layers (two, for consistency with other sections) */}
        {/* <BackgroundNoise zIndex={1} opacity={0.8} /> */}

        {/* Remains background animation, removed for now */}
        {/* <div className="absolute left-[var(--px-1)] top-[var(--px-1)] w-[var(--px-1151)] h-[var(--px-626)]">
          {isVisible && <Remains />}
        </div> */}

        {/* Overlay content */}
        <div className="absolute inset-0 flex flex-col items-end justify-between w-full h-full select-none">
          <div className="flex flex-col text-start my-auto w-full relative z-15">
            <div className="w-full justify-start h-[var(--px-164)] mt-[var(--px-42)]">
              <span className="text-[length:var(--px-100)] font-benzin uppercase leading-[var(--px-150)]">RESOMIX</span>
            </div>
            <div className='flex w-full justify-between items-start -mt-[var(--px-34)]'>
              <div className='flex gap-[var(--px-12)]'>
                <img className="w-[var(--px-35)] h-[var(--px-35)]" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.6))" }} aria-hidden="true" loading="lazy" draggable={false} src={ArrowSmallDown} alt="Arrow Small Down" />
                <div className="justify-start text-[length:var(--px-16)] font-normal font-helvetica uppercase leading-5 text-[var(--color-primary)]" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>A sound analysis platform that helps DJs <br />discover tracks by feeling, not by genre. </div>
              </div>
              <span className="text-[length:var(--px-55)] font-helvetica uppercase leading-[var(--px-40)]">Align with your sound</span>
            </div>
            <div className="flex justify-end w-full min-w-[var(--px-204-5)] mt-[var(--px-42)]">
              <ButtonHeavyRight text="Upload Your Track" onClick={() => {
                window.location.href = BASE_BETA_URL
              }} link_arrow={true} className="cta-button primary" id="home-hero-upload-button" />
            </div>
          </div>
          <div className="flex gap-[var(--px-4)] mr-[var(--px-8)] mb-[var(--px-8)] relative z-15">
            <IconComp
              svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" draggable={false} src={FbSvg} alt="" aria-hidden="true" loading="lazy" />}
              className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)] social-icon"
              padding=""
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              ariaLabel="Visit Resomix on Facebook"
              id="home-hero-facebook-icon"
            />
            <IconComp
              svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" draggable={false} src={InstaSvg} alt="" aria-hidden="true" loading="lazy" />}
              className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)] social-icon"
              padding=""
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              ariaLabel="Visit Resomix on Instagram"
              id="home-hero-instagram-icon"
            />
            <IconComp
              svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" draggable={false} src={XSvg} alt="" aria-hidden="true" loading="lazy" />}
              className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)] social-icon"
              padding=""
              href={TWITTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              ariaLabel="Visit Resomix on X (Twitter)"
              id="home-hero-twitter-icon"
            />
          </div>
        </div>
      </div>

      {/* Text below the SVG clip path */}
      <div className='flex justify-center items-center gap-[var(--px-8)] relative z-15'>
        <div className="text-right justify-start text-[length:var(--px-18)] font-light font-helvetica uppercase leading-5">Unbounded by trends,<br />built for emotional resonance</div>
        <img src={SoundWaves} aria-hidden="true" loading="lazy" draggable={false} className="w-[var(--px-55)] h-[var(--px-44)]" alt="Sound Waves" />
      </div>
    </div>
  );
};

export default HomeHero;
