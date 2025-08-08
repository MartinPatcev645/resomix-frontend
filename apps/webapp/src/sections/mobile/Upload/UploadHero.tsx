import React, { useRef } from "react";
import { CodeTyping, IconComp } from "@resomix/ui";
import ArrowDownRightSvg from "@/assets/icons/arrow_down_right.svg";
import XSvg from "@/assets/icons/twitter_x.svg";
import InstaSvg from "@/assets/icons/instagram.svg";
import FbSvg from "@/assets/icons/facebook.svg";

const UploadHero: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");

  return (
    <div ref={sectionRef} className="relative z-20 flex flex-col items-center justify-center gap-[var(--px-40)]">
      <div className="text-center text-[length:var(--px-10)] font-fira leading-[var(--px-20)] font-extralight tracking-[var(--px-2)] mt-[var(--px-60)]">
        <CodeTyping
          text='// RESOMIX SYSTEM v1.0.9 [booting...]<br />init.protocol("resonance_scan")'
          speed={100}
          multiline={true}
        />
      </div>
      <div className="flex flex-col items-start w-full gap-[var(--px-20)]">
        <div className="text-[length:var(--px-49)] font-helvetica leading-[var(--px-50)] font-bold uppercase">Here's<br />where<br />the journey<br /><span className="italic">begins</span></div>
        <div className="text-[length:var(--px-20)] font-helvetica font-extralight leading-[var(--px-24)] uppercase">upload a reference track,<br />and unlock a universe<br />of sounds</div>
        <img src={ArrowDownRightSvg} alt="arrow_down_right" className="w-[var(--px-44)] h-[var(--px-44)]" />
      </div>
      <div className="text-center text-[length:var(--px-10)] font-fira leading-[var(--px-20)] font-extralight tracking-[var(--px-2)]">
        <CodeTyping
          text='/* Beginning Sonic Transition */<br />[✓] Welcome to Resomix'
          speed={100}
          multiline={true}
          delay={1200}
        />
      </div>
      <div className="flex gap-[var(--px-4)] relative z-15">
        <IconComp
          svg={<img className="w-[var(--px-23)] h-[var(--px-23)]" src={FbSvg} alt="Fb" />}
          className="w-[var(--px-23)] h-[var(--px-23)] px-[var(--px-5)]"
          padding=""
          onClick={() => window.open("https://www.facebook.com/resomix", "_blank")}
        />
        <IconComp
          svg={<img className="w-[var(--px-23)] h-[var(--px-23)]" src={InstaSvg} alt="Insta" />}
          className="w-[var(--px-23)] h-[var(--px-23)] px-[var(--px-5)]"
          padding=""
          onClick={() => window.open("https://www.instagram.com/resomix", "_blank")}
        />
        <IconComp
          svg={<img className="w-[var(--px-23)] h-[var(--px-23)]" src={XSvg} alt="X" />}
          className="w-[var(--px-23)] h-[var(--px-23)] px-[var(--px-5)]"
          padding=""
          onClick={() => window.open("https://twitter.com/resomix", "_blank")}
        />
      </div>
    </div>
  );
};

export default UploadHero;
