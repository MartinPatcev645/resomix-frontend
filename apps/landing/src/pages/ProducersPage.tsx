import { useEffect, useMemo } from 'react';
import { PrHero } from '@/sections/producers/PrHero.tsx';
import { PrStatement } from '@/sections/producers/PrStatement.tsx';
import { PrBlock } from '@/sections/producers/PrBlock.tsx';
import { PrPaths } from '@/sections/producers/PrPaths.tsx';
import { PrCraft } from '@/sections/producers/PrCraft.tsx';
import { PrFinalCta } from '@/sections/producers/PrFinalCta.tsx';
import { FaqSection } from '@/sections/shared/FaqSection.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.webp';
import voidGrainLight from '@/assets/void-field/void-grain-light.webp';
import '@/sections/producers/producers.css';

export default function ProducersPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1

  // Continuous animations only while the owning section is in viewport
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const sections = Array.from(document.querySelectorAll('.pr-page .pr-section'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('pr-anim');
          } else {
            en.target.classList.remove('pr-anim');
          }
        });
      },
      { threshold: 0.05 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [motionOn]);

  const assetVars = {
    '--pr-plate-dark': `url(${voidFieldDark})`,
    '--pr-plate-light': `url(${voidFieldLight})`,
    '--pr-grain-dark': `url(${voidGrainDark})`,
    '--pr-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`pr-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'pr-motion-on' : 'pr-motion-reduced'}`}
      style={assetVars}
    >
      <div className="pr-layer pr-layer-plate" aria-hidden="true" />
      <div className="pr-layer pr-layer-grain" aria-hidden="true" />
      <main>
        <PrHero />
        <PrStatement />
        <PrBlock />
        <PrPaths />
        <PrCraft />
        <FaqSection ns="producers" />
        <PrFinalCta />
      </main>
    </div>
  );
}
