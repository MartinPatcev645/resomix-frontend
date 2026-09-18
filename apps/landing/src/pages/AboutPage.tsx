import { useEffect, useMemo } from 'react';
import { AbDefsProvider, AbSharedDefs } from '@/sections/about/AbSharedDefs.tsx';
import { AbHero } from '@/sections/about/AbHero.tsx';
import { AbMission } from '@/sections/about/AbMission.tsx';
import { AbEvidence } from '@/sections/about/AbEvidence.tsx';
import { AbEvolution } from '@/sections/about/AbEvolution.tsx';
import { AbVision } from '@/sections/about/AbVision.tsx';
import { AbPrinciples } from '@/sections/about/AbPrinciples.tsx';
import { AbShelf } from '@/sections/about/AbShelf.tsx';
import { AbValues } from '@/sections/about/AbValues.tsx';
import { AbAudiences } from '@/sections/about/AbAudiences.tsx';
import { AbPartners } from '@/sections/about/AbPartners.tsx';
import { AbTeam } from '@/sections/about/AbTeam.tsx';
import { AbFounder } from '@/sections/about/AbFounder.tsx';
import { AbClosing } from '@/sections/about/AbClosing.tsx';
import { FaqSection } from '@/sections/shared/FaqSection.tsx';
import '@/sections/about/about.css';


export default function AboutPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Draw-once reveal: sections go .live on first intersection, then unobserve.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('.ab-page .ab-section'));
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

  // Parallax only where the preview has .plx (S1 / S5), rAF-throttled ×−22px.
  useEffect(() => {
    if (!motionOn) return;
    const hosts = Array.from(
      document.querySelectorAll<HTMLElement>('.ab-page #ab-s1, .ab-page #ab-s5'),
    );
    if (!hosts.length) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        hosts.forEach((host) => {
          const r = host.getBoundingClientRect();
          if (!r.height) return;
          const p = Math.max(
            -1,
            Math.min(1, (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight),
          );
          host.querySelectorAll<SVGElement>('.ab-plx').forEach((node) => {
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

  return (
    <div className={`ab-page relative font-helvetica font-light ${motionOn ? 'ab-motion-on' : 'ab-motion-reduced'}`}>
      <AbDefsProvider>
        <AbSharedDefs />
        <main>
          <AbHero />
          <AbMission />
          <AbEvidence />
          <AbEvolution />
          <AbVision />
          <AbPrinciples />
          <AbShelf />
          <AbValues />
          <AbAudiences />
          <AbPartners />
          <AbTeam />
          <AbFounder />
          <FaqSection ns="about" />
          <AbClosing />
        </main>
      </AbDefsProvider>
    </div>
  );
}
