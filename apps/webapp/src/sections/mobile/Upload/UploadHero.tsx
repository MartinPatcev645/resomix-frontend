import React, { useRef } from "react";
import { CodeTyping } from "@resomix/ui";
import ArrowDownRightSvg from "@/assets/icons/arrow_down_right.svg";

const UploadHero: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");

  return (
    <div ref={sectionRef} className="relative z-20 flex flex-col items-center justify-center gap-[var(--px-40)]">
      <div className="text-center text-[length:var(--px-10)] font-fira leading-[var(--px-14)] font-extralight tracking-[var(--px-2)] mt-[var(--px-60)]">
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
      <div>Okay</div>
      <div>Okay</div>
    </div>
  );
};

export default UploadHero;
