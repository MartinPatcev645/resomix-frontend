import React, { useRef } from "react";
import { CodeTyping, IconComp } from "@resomix/ui";
import ArrowDownRightSvg from "@/assets/icons/arrow_down_right.svg";
import XSvg from "@/assets/icons/twitter_x.svg";
import InstaSvg from "@/assets/icons/instagram.svg";
import FbSvg from "@/assets/icons/facebook.svg";
import { FACEBOOK_URL, INSTAGRAM_URL, TWITTER_URL } from "@resomix/config";

const UploadHero: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");

  return (
    <div ref={sectionRef} className="relative z-20 flex flex-col items-center justify-between gap-[var(--px-40)] min-h-[var(--px-670)] h-[var(--px-670)]">
      <div className="text-center text-[length:var(--px-10)] font-fira leading-[var(--px-20)] font-extralight tracking-[var(--px-2)] mt-[var(--px-60)] min-h-[var(--px-33)]">
        <CodeTyping
          text='// RESOMIX SYSTEM v1.0.9 [booting...]<br />init.protocol("resonance_scan")'
          speed={100}
          multiline={true}
        />
      </div>
      <div className="flex flex-col items-start w-full gap-[var(--px-20)]">
        <h1 className="text-[length:var(--px-49)] font-helvetica leading-[var(--px-50)] font-bold uppercase">Here's<br />where<br />the journey<br /><span className="italic">begins</span></h1>
        <div className="text-[length:var(--px-20)] font-helvetica font-extralight leading-[var(--px-24)] uppercase">upload a reference track,<br />and unlock a universe<br />of sounds</div>
        <img src={ArrowDownRightSvg} draggable={false} alt="" aria-hidden="true" loading="lazy" className="w-[var(--px-44)] h-[var(--px-44)]" />
      </div>
      <div className="text-center text-[length:var(--px-10)] font-fira leading-[var(--px-20)] font-extralight tracking-[var(--px-2)] min-h-[var(--px-33)]">
        <CodeTyping
          text='/* Beginning Sonic Transition */<br />[✓] Welcome to Resomix'
          speed={100}
          multiline={true}
          delay={1200}
        />
      </div>
      <div className="flex gap-[var(--px-15)] relative z-15">
        <IconComp
          svg={<img className="w-[var(--px-30)] h-[var(--px-30)]" draggable={false} src={FbSvg} alt="" aria-hidden="true" />}
          className="w-[var(--px-30)] h-[var(--px-30)] px-[var(--px-5)] social-icon"
          padding=""
          href={FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          ariaLabel="Visit Resomix on Facebook"
          id="upload-hero-facebook-icon"
        />
        <IconComp
          svg={<img className="w-[var(--px-30)] h-[var(--px-30)]" draggable={false} src={InstaSvg} alt="" aria-hidden="true" />}
          className="w-[var(--px-30)] h-[var(--px-30)] px-[var(--px-5)] social-icon"
          padding=""
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          ariaLabel="Visit Resomix on Instagram"
          id="upload-hero-instagram-icon"
        />
        <IconComp
          svg={<img className="w-[var(--px-30)] h-[var(--px-30)]" draggable={false} src={XSvg} alt="" aria-hidden="true" />}
          className="w-[var(--px-30)] h-[var(--px-30)] px-[var(--px-5)] social-icon"
          padding=""
          href={TWITTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          ariaLabel="Visit Resomix on X (Twitter)"
          id="upload-hero-twitter-icon"
        />
      </div>
    </div>
  );
};

export default UploadHero;
