import React, { useEffect, useMemo, useRef, useState } from "react";
// import GridTunnelSvg from "@/assets/icons/mobile_tunnel.svg";
import AngleDownSvg from "@/assets/icons/AngleDown.svg";
import { Tunnel } from "@resomix/ui";
// import { Tunnel, StaticNoise } from "@resomix/ui";

const HomeSix: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3); // start smaller on mobile
  const ASPECT = 726 / 353; // height / width for mobile tunnel

  // Section height = 3 × tunnel height, tunnel height = 100vw × aspect
  const sectionHeightStyle = useMemo(() => `calc(100vw * ${ASPECT * 3})`, []);

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;

      const sectionHeight = el.offsetHeight;
      const pinnedDuration = Math.max(sectionHeight - vh, 0);
      const startAt = vh / 2;
      const distance = Math.min(Math.max(startAt - rect.top, 0), pinnedDuration);
      const progress = pinnedDuration > 0 ? distance / pinnedDuration : 0;
      const mapped = 0.3 + (1 - 0.3) * progress; // 0.3 → 1.0
      setScale(mapped);
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
    <div ref={sectionRef} className='relative z-15' style={{ height: sectionHeightStyle }}>
      {/* Top spacer (~50px) */}
      <div style={{ height: "var(--px-50)" }} />

      {/* Sticky viewport */}
      <div className='sticky top-0 h-screen w-full'>
        {/* Tunnel pinned in background */}
        <div className='absolute inset-0 pointer-events-none'>
          <Tunnel aspectRatio={ASPECT} />
        </div>

        {/* Box area positioned similarly to desktop setup */}
        <div className='absolute top-[-10%] h-full w-full'>
          {/* Scaling text rectangle with noise fill */}
          <div
            style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
            className='relative my-[var(--px-110)] mx-[var(--px-50)]'
          >
            <div className='absolute inset-0 border-2 border-[var(--color-noise-border)] bg-[var(--color-primary-background)] overflow-hidden z-0'>
              {/* <StaticNoise className='pointer-events-none absolute inset-0' /> */}
            </div>

            {/* Text content (keep mobile sizes) */}
            <div className='relative flex-col justify-between h-full w-full py-[var(--px-15)] px-[var(--px-25)] z-10'>
              <div className='flex w-full justify-center text-[length:var(--px-14)] leading-[var(--px-16)] font-extralight font-auger'>
                To all DJs lost in the vastness of the modern sound universe:
                let Resomix be the gravitational force that draws you
                to the tracks you need.
              </div>
              <div className='flex my-[var(--px-100)] w-full justify-center text-center text-[length:var(--px-20)] font-helvetica uppercase leading-[var(--px-20)]'>
                RESOMIX revolutionized music
                discovery by putting sound first
              </div>
              <div className='flex w-full justify-center text-[length:var(--px-14)] leading-[var(--px-16)] font-extralight font-auger'>
                Cutting-edge Machine Learning to Enhance
                Human Imagination, Proprietary models designed
                to listen like producers, and discover like DJs.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacer (~50px) */}
      <div style={{ height: "var(--px-50)" }} />
    </div>

    {/* Arrow after the sticky section */}
    <div className="flex w-full justify-center mt-[var(--px-40)]">
      <img src={AngleDownSvg} draggable={false} alt="Angle Down" className="w-[var(--px-67)] h-[var(--px-67)]" />
    </div>
    </>
  );
};

export default HomeSix;
