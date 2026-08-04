import { useEffect, useMemo } from 'react';
import { HmVoidBackground } from '@/sections/home/HmVoidBackground.tsx';
import { HmHero } from '@/sections/home/HmHero.tsx';
import { HmStatement } from '@/sections/home/HmStatement.tsx';
import { HmProductWorlds } from '@/sections/home/HmProductWorlds.tsx';
import { HmStartTrack } from '@/sections/home/HmStartTrack.tsx';
import { HmTrackIntelligence } from '@/sections/home/HmTrackIntelligence.tsx';
import { HmCatalogue } from '@/sections/home/HmCatalogue.tsx';
import { HmApi } from '@/sections/home/HmApi.tsx';
import { HmAudiences } from '@/sections/home/HmAudiences.tsx';
import { HmTrust } from '@/sections/home/HmTrust.tsx';
import { HmFinalCta } from '@/sections/home/HmFinalCta.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.webp';
import voidGrainLight from '@/assets/void-field/void-grain-light.webp';
import '@/sections/home/home.css';

export default function HomePage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1

  // Continuous animations only while the owning section is in viewport
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const sections = Array.from(document.querySelectorAll('.hm-page .hm-section'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('hm-anim');
          } else {
            en.target.classList.remove('hm-anim');
          }
        });
      },
      { threshold: 0.05 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [motionOn]);

  const assetVars = {
    '--hm-plate-dark': `url(${voidFieldDark})`,
    '--hm-plate-light': `url(${voidFieldLight})`,
    '--hm-grain-dark': `url(${voidGrainDark})`,
    '--hm-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`hm-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'hm-motion-on' : 'hm-motion-reduced'}`}
      style={assetVars}
    >
      <HmVoidBackground />
      <main>
        <HmHero />
        <HmStatement />
        <HmProductWorlds />
        <HmStartTrack />
        <HmTrackIntelligence />
        <HmCatalogue />
        <HmApi />
        <HmAudiences />
        <HmTrust />
        <HmFinalCta />
      </main>
    </div>
  );
}
