import { useEffect, useMemo } from 'react';
import { McuHero } from '@/sections/music-curators/McuHero.tsx';
import { McuStatement } from '@/sections/music-curators/McuStatement.tsx';
import { McuGap } from '@/sections/music-curators/McuGap.tsx';
import { McuRail } from '@/sections/music-curators/McuRail.tsx';
import { McuPhilosophy } from '@/sections/music-curators/McuPhilosophy.tsx';
import { McuFinalCta } from '@/sections/music-curators/McuFinalCta.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/music-curators/music-curators.css';

export default function MusicCuratorsPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Music Curators — Hear Music Differently | Resomix';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Continuous animations only while the owning section is in viewport
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const sections = Array.from(document.querySelectorAll('.mcu-page .mcu-section'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('mcu-anim');
          } else {
            en.target.classList.remove('mcu-anim');
          }
        });
      },
      { threshold: 0.05 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [motionOn]);

  const assetVars = {
    '--mcu-plate-dark': `url(${voidFieldDark})`,
    '--mcu-plate-light': `url(${voidFieldLight})`,
    '--mcu-grain-dark': `url(${voidGrainDark})`,
    '--mcu-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`mcu-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'mcu-motion-on' : 'mcu-motion-reduced'}`}
      style={assetVars}
    >
      <div className="mcu-layer mcu-layer-plate" aria-hidden="true" />
      <div className="mcu-layer mcu-layer-grain" aria-hidden="true" />
      <main>
        <McuHero />
        <McuStatement />
        <McuGap />
        <McuRail />
        <McuPhilosophy />
        <McuFinalCta />
      </main>
    </div>
  );
}
