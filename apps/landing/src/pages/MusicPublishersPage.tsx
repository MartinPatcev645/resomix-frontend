import { useEffect, useMemo } from 'react';
import { MpVoidBackground } from '@/sections/music-publishers/MpVoidBackground.tsx';
import { MpDefsProvider, MpSharedDefs } from '@/sections/music-publishers/MpSharedDefs.tsx';
import { MpHero } from '@/sections/music-publishers/MpHero.tsx';
import { MpEditorial } from '@/sections/music-publishers/MpEditorial.tsx';
import { MpVisibilityGap } from '@/sections/music-publishers/MpVisibilityGap.tsx';
import { MpActivate } from '@/sections/music-publishers/MpActivate.tsx';
import { MpOutcomes } from '@/sections/music-publishers/MpOutcomes.tsx';
import { MpCrossEra } from '@/sections/music-publishers/MpCrossEra.tsx';
import { MpClosing } from '@/sections/music-publishers/MpClosing.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/music-publishers/music-publishers.css';

export default function MusicPublishersPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Music Publishers — Turn Your Catalogue Into a Living Asset | Resomix';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Draw-once reveal: sections go .live on first intersection, then unobserve.
  // Reduced motion (or no IO) resolves straight to the finished state.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('.mp-page .mp-section'));
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
  // SideLines mounts a desktop and a mobile copy of the page, so each hero is
  // measured against its own rect — the hidden copy simply resolves to zero.
  useEffect(() => {
    if (!motionOn) return;
    const heroes = Array.from(document.querySelectorAll<HTMLElement>('.mp-page .mp-hero'));
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
          hero.querySelectorAll<SVGElement>('.plx').forEach((node) => {
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
    '--mp-plate-dark': `url(${voidFieldDark})`,
    '--mp-plate-light': `url(${voidFieldLight})`,
    '--mp-grain-dark': `url(${voidGrainDark})`,
    '--mp-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`mp-page relative font-helvetica font-light ${motionOn ? 'mp-motion-on' : 'mp-motion-reduced'}`}
      style={assetVars}
    >
      <MpVoidBackground />
      <MpDefsProvider>
        <MpSharedDefs />
        <main>
          <MpHero />
          <MpEditorial />
          <MpVisibilityGap />
          <MpActivate />
          <MpOutcomes />
          <MpCrossEra />
          <MpClosing />
        </main>
      </MpDefsProvider>
    </div>
  );
}
