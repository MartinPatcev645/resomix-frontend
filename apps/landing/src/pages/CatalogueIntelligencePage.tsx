import { useEffect, useMemo } from 'react';
import { CiVoidBackground } from '@/sections/catalogue-intelligence/CiVoidBackground.tsx';
import { CiDefsProvider, CiSharedDefs } from '@/sections/catalogue-intelligence/CiSharedDefs.tsx';
import { CiHero } from '@/sections/catalogue-intelligence/CiHero.tsx';
import { CiProduct } from '@/sections/catalogue-intelligence/CiProduct.tsx';
import { CiFlow } from '@/sections/catalogue-intelligence/CiFlow.tsx';
import { CiTrackIntel } from '@/sections/catalogue-intelligence/CiTrackIntel.tsx';
import { CiValue } from '@/sections/catalogue-intelligence/CiValue.tsx';
import { CiPartner } from '@/sections/catalogue-intelligence/CiPartner.tsx';
import { CiBoundary } from '@/sections/catalogue-intelligence/CiBoundary.tsx';
import { CiPilot } from '@/sections/catalogue-intelligence/CiPilot.tsx';
import { CiClosing } from '@/sections/catalogue-intelligence/CiClosing.tsx';
import { FaqSection } from '@/sections/shared/FaqSection.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.webp';
import voidGrainLight from '@/assets/void-field/void-grain-light.webp';
import '@/sections/catalogue-intelligence/catalogue-intelligence.css';


export default function CatalogueIntelligencePage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Draw-once reveal: sections go .live on first intersection, then unobserve.
  // Reduced motion (or no IO) resolves straight to the finished state.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('.ci-page .ci-section'));
    if (!sections.length) return;

    if (!motionOn || !('IntersectionObserver' in window)) {
      sections.forEach((s) => s.classList.add('live'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('live');
          io.unobserve(en.target);
        });
      },
      { threshold: 0.15 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [motionOn]);

  // Hero two-plane parallax, rAF-throttled and gated on motion.
  // querySelectorAll, not querySelector: harmless now that SideLines renders the page once, and
  // it keeps this correct if a layout ever mounts the hero more than once again.
  useEffect(() => {
    if (!motionOn) return;
    const heroes = Array.from(document.querySelectorAll<HTMLElement>('.ci-page .ci-hero'));
    if (!heroes.length) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        heroes.forEach((hero) => {
          const r = hero.getBoundingClientRect();
          if (!r.height) return;
          const p = Math.max(
            -1,
            Math.min(1, (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight),
          );
          hero.querySelectorAll<SVGElement>('.ci-plx').forEach((node) => {
            const f = parseFloat(node.getAttribute('data-plx') || '0');
            node.style.transform = `translateY(${(p * f * -22).toFixed(1)}px)`;
          });
        });
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [motionOn]);

  const assetVars = {
    '--ci-plate-dark': `url(${voidFieldDark})`,
    '--ci-plate-light': `url(${voidFieldLight})`,
    '--ci-grain-dark': `url(${voidGrainDark})`,
    '--ci-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`ci-page relative font-helvetica font-light ${motionOn ? 'ci-motion-on' : 'ci-motion-reduced'}`}
      style={assetVars}
    >
      <CiVoidBackground />
      <CiDefsProvider>
        <CiSharedDefs />
        <main>
          <CiHero />
          <CiProduct />
          <CiFlow />
          <CiTrackIntel />
          <CiValue />
          <CiPartner />
          <CiBoundary />
          <CiPilot />
          <FaqSection ns="catalogueIntelligence" />
          <CiClosing />
        </main>
      </CiDefsProvider>
    </div>
  );
}
