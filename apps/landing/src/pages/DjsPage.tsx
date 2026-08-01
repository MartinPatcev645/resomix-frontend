import { useEffect, useMemo } from 'react';
import { DjHero } from '@/sections/djs/DjHero.tsx';
import { DjStatement } from '@/sections/djs/DjStatement.tsx';
import { DjLibrary } from '@/sections/djs/DjLibrary.tsx';
import { DjJourneys } from '@/sections/djs/DjJourneys.tsx';
import { DjUnique } from '@/sections/djs/DjUnique.tsx';
import { DjFinalCta } from '@/sections/djs/DjFinalCta.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/djs/djs.css';

export default function DjsPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'DJs — Dig Less. Discover More. | Resomix';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Continuous animations only while the owning section is in viewport
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const sections = Array.from(document.querySelectorAll('.dj-page .dj-section'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('dj-anim');
          } else {
            en.target.classList.remove('dj-anim');
          }
        });
      },
      { threshold: 0.05 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [motionOn]);

  const assetVars = {
    '--dj-plate-dark': `url(${voidFieldDark})`,
    '--dj-plate-light': `url(${voidFieldLight})`,
    '--dj-grain-dark': `url(${voidGrainDark})`,
    '--dj-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`dj-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'dj-motion-on' : 'dj-motion-reduced'}`}
      style={assetVars}
    >
      <div className="dj-layer dj-layer-plate" aria-hidden="true" />
      <div className="dj-layer dj-layer-grain" aria-hidden="true" />
      <main>
        <DjHero />
        <DjStatement />
        <DjLibrary />
        <DjJourneys />
        <DjUnique />
        <DjFinalCta />
      </main>
    </div>
  );
}
