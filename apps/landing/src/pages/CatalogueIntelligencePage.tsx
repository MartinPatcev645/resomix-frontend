import { useCallback, useEffect, useMemo, useState } from 'react';
import { CiVoidBackground } from '@/sections/catalogue-intelligence/CiVoidBackground.tsx';
import { CiActivationHero } from '@/sections/catalogue-intelligence/CiActivationHero.tsx';
import { CiWorkflowLine } from '@/sections/catalogue-intelligence/CiWorkflowLine.tsx';
import { CiFindConsole } from '@/sections/catalogue-intelligence/CiFindConsole.tsx';
import { CiAttentionMap } from '@/sections/catalogue-intelligence/CiAttentionMap.tsx';
import { CiCampaignWorkspace } from '@/sections/catalogue-intelligence/CiCampaignWorkspace.tsx';
import { CiTeamLenses } from '@/sections/catalogue-intelligence/CiTeamLenses.tsx';
import { CiPilot } from '@/sections/catalogue-intelligence/CiPilot.tsx';
import { CiFinalCta } from '@/sections/catalogue-intelligence/CiFinalCta.tsx';
import { type FieldState, type Match } from '@/sections/catalogue-intelligence/ciEngine.ts';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/catalogue-intelligence/catalogue-intelligence.css';

export default function CatalogueIntelligencePage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const [fieldState, setFieldState] = useState<FieldState>({ ref: 'a', sel: 0 });
  const [shortlist, setShortlist] = useState<Match[]>([]);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Catalogue Intelligence — Make Every Track Discoverable by Sound | Resomix';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Draw-once motion — IO on HTML containers, not SVG paths
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const containers: Element[] = [];
    document.querySelectorAll('.ci-page .ci-draw').forEach((p) => {
      try {
        const path = p as SVGPathElement;
        const len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 800;
        path.style.strokeDasharray = String(len);
        path.style.setProperty('--len', String(len));
        path.style.strokeDashoffset = String(len);
        path.classList.add('ci-armed');
      } catch {
        /* non-path */
      }
      const host =
        p.closest('.ci-field, .ci-flowline-wrap, .ci-lens-viz') || p.closest('section');
      if (host && !containers.includes(host)) containers.push(host);
    });

    const settle = (path: Element) => {
      const el = path as SVGPathElement;
      el.style.strokeDasharray = 'none';
      el.style.strokeDashoffset = '0';
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting && en.intersectionRatio <= 0) return;
          io.unobserve(en.target);
          en.target.querySelectorAll('.ci-draw').forEach((path) => {
            path.classList.add('ci-play');
            path.addEventListener('animationend', () => settle(path), { once: true });
            setTimeout(() => settle(path), 1400);
          });
        });
      },
      { threshold: [0, 0.01] },
    );

    containers.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [motionOn, fieldState]);

  const scrollToHow = useCallback(() => {
    document.getElementById('ci-how')?.scrollIntoView({
      behavior: motionOn ? 'smooth' : 'auto',
      block: 'start',
    });
  }, [motionOn]);

  const handleAddToShortlist = useCallback((match: Match) => {
    setShortlist((prev) => (prev.some((p) => p.t === match.t) ? prev : [...prev, match]));
  }, []);

  const assetVars = {
    '--ci-plate-dark': `url(${voidFieldDark})`,
    '--ci-plate-light': `url(${voidFieldLight})`,
    '--ci-grain-dark': `url(${voidGrainDark})`,
    '--ci-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`ci-page relative text-[var(--color-primary)] font-helvetica ${motionOn ? 'ci-motion-on' : 'ci-motion-reduced'}`}
      style={assetVars}
    >
      <CiVoidBackground />

      <div className="ci-frame">
        <CiActivationHero
          fieldState={fieldState}
          onFieldStateChange={setFieldState}
          onScrollToHow={scrollToHow}
        />
        <CiWorkflowLine />
        <CiFindConsole shortlist={shortlist} onAddToShortlist={handleAddToShortlist} />
        <CiAttentionMap />
        <CiCampaignWorkspace shortlist={shortlist} />
        <CiTeamLenses />
        <CiPilot />
        <CiFinalCta />
      </div>
    </div>
  );
}
