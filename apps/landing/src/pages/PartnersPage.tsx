import { useEffect, useMemo, useState } from 'react';
import { PnVoidBackground } from '@/sections/partners/PnVoidBackground.tsx';
import { PnJunctionHero } from '@/sections/partners/PnJunctionHero.tsx';
import { PnPathPanels } from '@/sections/partners/PnPathPanels.tsx';
import { PnCapabilityBranches } from '@/sections/partners/PnCapabilityBranches.tsx';
import { PnEngagementLine } from '@/sections/partners/PnEngagementLine.tsx';
import { PnAudiences } from '@/sections/partners/PnAudiences.tsx';
import { PnControl } from '@/sections/partners/PnControl.tsx';
import { PnContactForm } from '@/sections/partners/PnContactForm.tsx';
import { FaqSection } from '@/sections/shared/FaqSection.tsx';
import type { RouteId } from '@/sections/partners/pnData.ts';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.webp';
import voidGrainLight from '@/assets/void-field/void-grain-light.webp';
import '@/sections/partners/partners.css';

export default function PartnersPage() {
  const [activePath, setActivePath] = useState<RouteId>('api');

  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const containers: Element[] = [];
    document.querySelectorAll('.pn-page .pn-draw').forEach((p) => {
      try {
        const path = p as SVGGeometryElement;
        const len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 800;
        path.style.strokeDasharray = String(len);
        path.style.setProperty('--len', String(len));
        path.style.strokeDashoffset = String(len);
        path.classList.add('pn-armed');
      } catch {
        /* non-path */
      }
      const host = p.closest('.pn-junction') || p.closest('section');
      if (host && !containers.includes(host)) containers.push(host);
    });

    const settle = (path: Element) => {
      const el = path as SVGGeometryElement;
      el.style.strokeDasharray = 'none';
      el.style.strokeDashoffset = '0';
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting && en.intersectionRatio <= 0) return;
          io.unobserve(en.target);
          en.target.querySelectorAll('.pn-draw').forEach((path) => {
            path.classList.add('pn-play');
            path.addEventListener('animationend', () => settle(path), { once: true });
            setTimeout(() => settle(path), 1400);
          });
        });
      },
      { threshold: [0, 0.01] },
    );

    containers.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [motionOn, activePath]);

  const assetVars = {
    '--pn-plate-dark': `url(${voidFieldDark})`,
    '--pn-plate-light': `url(${voidFieldLight})`,
    '--pn-grain-dark': `url(${voidGrainDark})`,
    '--pn-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`pn-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'pn-motion-on' : 'pn-motion-reduced'}`}
      style={assetVars}
    >
      <PnVoidBackground />
      <div className="pn-frame">
        <PnJunctionHero activePath={activePath} onSelectPath={setActivePath} />
        <PnPathPanels activePath={activePath} onSelectPath={setActivePath} />
        <PnCapabilityBranches />
        <PnEngagementLine />
        <PnAudiences activePath={activePath} onSelectPath={setActivePath} />
        <PnControl />
        <FaqSection ns="partners" />
        <PnContactForm />
      </div>
    </div>
  );
}
