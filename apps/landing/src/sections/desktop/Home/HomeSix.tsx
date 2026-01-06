import React, { useEffect, useMemo, useRef, useState } from "react";
// import GridTunnelSvg from "@/assets/icons/grid_tunnel.svg";
import AngleDownSvg from "@/assets/icons/AngleDown.svg";
import { Tunnel, StaticNoise } from "@resomix/ui";

const HomeSix: React.FC = () => {
  // Reference to the whole section to measure scroll progress
  const sectionRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6); // start small
  const ASPECT = 1268 / 1555; // keep in sync with <Tunnel aspectRatio={...}>

  // Height of the section = max(300vh, 3 × tunnel height)
  const sectionHeightStyle = useMemo(
    () => `max(300vh, calc(100vw * ${ASPECT * 3}))`,
    []
  );

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;

      const sectionHeight = el.offsetHeight;
      const pinnedDuration = Math.max(sectionHeight - vh, 0);
      const startAt = vh / 2; // zoom begins when section top reaches middle
      const distance = Math.min(Math.max(startAt - rect.top, 0), pinnedDuration);

      const progress = pinnedDuration > 0 ? distance / pinnedDuration : 0;
      const initialScale = 0.6;
      const finalScale = initialScale + (1 - initialScale) * progress;

      setScale(finalScale);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      <div ref={sectionRef} className="relative mt-[var(--px-150)] z-15" style={{ height: sectionHeightStyle }}>
        {/* Top spacer (~50px via pixels.css) so pin engages near center */}
        <div style={{ height: "var(--px-50)" }} />

        {/* Sticky layer pinned for the section; use stable viewport height */}
        <div className="sticky top-0 h-[100svh] w-full isolate">
          {/* Tunnel background fills viewport and remains fixed during the pinned span */}
          <div className="absolute inset-0 opacity-80 pointer-events-none">
            <Tunnel aspectRatio={ASPECT} />
          </div>

          {/* Center content wrapper to hold the scaling box */}
          <div className="absolute top-[18%] h-full w-full">
            {/* Scaling text rectangle */}
            <div
              style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
              className="relative my-[var(--px-110)] mx-[var(--px-50)]"
            >
              {/* Rectangle background with noise (tunnel hidden beneath) */}
              <div className="absolute inset-0 border-2 border-[var(--color-noise-border)] bg-[var(--color-secondary)] overflow-hidden z-0">
                <StaticNoise className="pointer-events-none absolute inset-0" />
              </div>

              {/* Text content */}
              <div className="relative flex-col justify-between h-full w-full py-[var(--px-15)] px-[var(--px-25)] z-10">
                <div className='flex w-full justify-end text-[length:var(--px-13)] font-extralight text-right font-auger opacity-70'>
                  To all DJs lost in the vastness of the modern sound universe:<br />
                  let Resomix be the gravitational force that draws you<br />
                  to the tracks you need.
                </div>
                <div className='flex my-[var(--px-100)] w-full justify-center text-center text-[length:var(--px-25)] font-medium font-helvetica uppercase leading-[var(--px-28)]'>
                  RESOMIX revolutionized music<br />
                  discovery by putting sound first
                </div>
                <div className='flex w-full justify-start text-[length:var(--px-13)] font-extralight text-left font-auger opacity-70'>
                  Cutting-edge Machine Learning to Enhance<br />
                  Human Imagination, Proprietary models designed<br />
                  to listen like producers, and discover like DJs.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom spacer (~50px) so pin releases near section end */}
        <div style={{ height: "var(--px-50)" }} />
      </div>
      {/* Arrow indicator appears only after the sticky section has fully scrolled past */}
      <div className="flex w-full justify-center mt-[var(--px-100)]">
        <img src={AngleDownSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Angle Down" className="w-[var(--px-52)] h-[var(--px-53)]" />
      </div>
    </>
  );
};

export default HomeSix;
