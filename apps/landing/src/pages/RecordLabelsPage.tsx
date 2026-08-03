import { useEffect, useMemo } from 'react';
import { RlVoidBackground } from '@/sections/record-labels/RlVoidBackground.tsx';
import { RlHero } from '@/sections/record-labels/RlHero.tsx';
import { RlStatement } from '@/sections/record-labels/RlStatement.tsx';
import { RlMetadata } from '@/sections/record-labels/RlMetadata.tsx';
import { RlQuote } from '@/sections/record-labels/RlQuote.tsx';
import { RlWorkflows } from '@/sections/record-labels/RlWorkflows.tsx';
import { RlCreativity } from '@/sections/record-labels/RlCreativity.tsx';
import { RlFinalCta } from '@/sections/record-labels/RlFinalCta.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/record-labels/record-labels.css';

export default function RecordLabelsPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1

  // Continuous animations only while the owning section is in viewport
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const sections = Array.from(document.querySelectorAll('.rl-page .rl-section'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('rl-anim');
          } else {
            en.target.classList.remove('rl-anim');
          }
        });
      },
      { threshold: 0.05 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [motionOn]);

  const assetVars = {
    '--rl-plate-dark': `url(${voidFieldDark})`,
    '--rl-plate-light': `url(${voidFieldLight})`,
    '--rl-grain-dark': `url(${voidGrainDark})`,
    '--rl-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`rl-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'rl-motion-on' : 'rl-motion-reduced'}`}
      style={assetVars}
    >
      <RlVoidBackground />
      <main>
        <RlHero />
        <RlStatement />
        <RlMetadata />
        <RlQuote />
        <RlWorkflows />
        <RlCreativity />
        <RlFinalCta />
      </main>
    </div>
  );
}
