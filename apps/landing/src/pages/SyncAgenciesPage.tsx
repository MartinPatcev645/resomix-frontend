import { useEffect, useMemo } from 'react';
import { SaVoidBackground } from '@/sections/sync-agencies/SaVoidBackground.tsx';
import { SaHero } from '@/sections/sync-agencies/SaHero.tsx';
import { SaIdea } from '@/sections/sync-agencies/SaIdea.tsx';
import { SaProblems } from '@/sections/sync-agencies/SaProblems.tsx';
import { SaWorkflows } from '@/sections/sync-agencies/SaWorkflows.tsx';
import { SaExpect } from '@/sections/sync-agencies/SaExpect.tsx';
import { SaFinalCta } from '@/sections/sync-agencies/SaFinalCta.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.webp';
import voidGrainLight from '@/assets/void-field/void-grain-light.webp';
import '@/sections/sync-agencies/sync-agencies.css';

export default function SyncAgenciesPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1

  // Continuous animations only while the owning section is in viewport
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const sections = Array.from(document.querySelectorAll('.sa-page .sa-section'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('sa-anim');
          } else {
            en.target.classList.remove('sa-anim');
          }
        });
      },
      { threshold: 0.05 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [motionOn]);

  const assetVars = {
    '--sa-plate-dark': `url(${voidFieldDark})`,
    '--sa-plate-light': `url(${voidFieldLight})`,
    '--sa-grain-dark': `url(${voidGrainDark})`,
    '--sa-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`sa-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'sa-motion-on' : 'sa-motion-reduced'}`}
      style={assetVars}
    >
      <SaVoidBackground />
      <main>
        <SaHero />
        <SaIdea />
        <SaProblems />
        <SaWorkflows />
        <SaExpect />
        <SaFinalCta />
      </main>
    </div>
  );
}
