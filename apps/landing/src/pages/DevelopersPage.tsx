import { useCallback, useEffect, useMemo, useState } from 'react';
import { DevVoidBackground } from '@/sections/developers/DevVoidBackground.tsx';
import { DevRequestRouterHero } from '@/sections/developers/DevRequestRouterHero.tsx';
import { DevCapabilityLanes } from '@/sections/developers/DevCapabilityLanes.tsx';
import { DevIsolation } from '@/sections/developers/DevIsolation.tsx';
import { DevEndpointConsole } from '@/sections/developers/DevEndpointConsole.tsx';
import { DevIngestionRail } from '@/sections/developers/DevIngestionRail.tsx';
import { DevSchemaMap } from '@/sections/developers/DevSchemaMap.tsx';
import { DevIntegrationAccess } from '@/sections/developers/DevIntegrationAccess.tsx';
import { DevEvaluationCta } from '@/sections/developers/DevEvaluationCta.tsx';
import { FaqSection } from '@/sections/shared/FaqSection.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.webp';
import voidGrainLight from '@/assets/void-field/void-grain-light.webp';
import '@/sections/developers/developers.css';

export default function DevelopersPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const [copyMsg, setCopyMsg] = useState('');

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1

  // Draw-once motion — IO on HTML containers, not SVG paths
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const containers: Element[] = [];
    document.querySelectorAll('.dev-page .dev-draw').forEach((p) => {
      try {
        const path = p as SVGPathElement;
        const len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 800;
        path.style.strokeDasharray = String(len);
        path.style.setProperty('--len', String(len));
        path.style.strokeDashoffset = String(len);
        path.classList.add('dev-armed');
      } catch {
        /* non-path */
      }
      const host =
        p.closest('.dev-router, .dev-iso-wrap, .dev-rail-wrap') || p.closest('section');
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
          en.target.querySelectorAll('.dev-draw').forEach((path) => {
            path.classList.add('dev-play');
            path.addEventListener('animationend', () => settle(path), { once: true });
            setTimeout(() => settle(path), 1400);
          });
        });
      },
      { threshold: [0, 0.01] },
    );

    containers.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [motionOn]);

  const handleCopy = useCallback((label: string) => {
    setCopyMsg(label);
    window.setTimeout(() => setCopyMsg(''), 1600);
  }, []);

  const assetVars = {
    '--dev-plate-dark': `url(${voidFieldDark})`,
    '--dev-plate-light': `url(${voidFieldLight})`,
    '--dev-grain-dark': `url(${voidGrainDark})`,
    '--dev-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`dev-page relative text-[var(--color-primary)] font-helvetica ${motionOn ? 'dev-motion-on' : 'dev-motion-reduced'}`}
      style={assetVars}
    >
      <DevVoidBackground />
      <span className="dev-sr" aria-live="polite">
        {copyMsg}
      </span>

      <div className="dev-frame">
        <DevRequestRouterHero />
        <DevCapabilityLanes />
        <DevIsolation />
        <DevEndpointConsole onCopy={handleCopy} />
        <DevIngestionRail />
        <DevSchemaMap onCopy={handleCopy} />
        <DevIntegrationAccess onCopy={handleCopy} />
        <FaqSection ns="developers" />
        <DevEvaluationCta />
      </div>
    </div>
  );
}
