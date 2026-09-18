import { useCallback, useEffect, useMemo, useState } from 'react';
import { PpVoidBackground } from '@/sections/partners-pilot/PpVoidBackground.tsx';
import { PpProtocolHero } from '@/sections/partners-pilot/PpProtocolHero.tsx';
import { PpQualification } from '@/sections/partners-pilot/PpQualification.tsx';
import { PpPilotPack } from '@/sections/partners-pilot/PpPilotPack.tsx';
import { PpMethod } from '@/sections/partners-pilot/PpMethod.tsx';
import { PpScorecard } from '@/sections/partners-pilot/PpScorecard.tsx';
import { PpDeliverables } from '@/sections/partners-pilot/PpDeliverables.tsx';
import { PpHandling } from '@/sections/partners-pilot/PpHandling.tsx';
import { PpApplyForm } from '@/sections/partners-pilot/PpApplyForm.tsx';
import { FaqSection } from '@/sections/shared/FaqSection.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.webp';
import voidGrainLight from '@/assets/void-field/void-grain-light.webp';
import '@/sections/partners-pilot/partners-pilot.css';

export default function PartnersPilotPage() {
  const [selectedStage, setSelectedStage] = useState(0);

  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1

  const scrollToMethod = useCallback(() => {
    const el = document.getElementById('method');
    el?.scrollIntoView({ behavior: motionOn ? 'smooth' : 'auto' });
  }, [motionOn]);

  // Draw-once motion — IO on HTML containers, not SVG paths
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const containers: Element[] = [];
    document.querySelectorAll('.pp-page .pp-draw').forEach((p) => {
      try {
        const path = p as SVGLineElement;
        const len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 800;
        path.style.strokeDasharray = String(len);
        path.style.setProperty('--len', String(len));
        path.style.strokeDashoffset = String(len);
        path.classList.add('pp-armed');
      } catch {
        /* non-path */
      }
      const host = p.closest('.pp-protocol') || p.closest('section');
      if (host && !containers.includes(host)) containers.push(host);
    });

    const settle = (path: Element) => {
      const el = path as SVGLineElement;
      el.style.strokeDasharray = 'none';
      el.style.strokeDashoffset = '0';
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting && en.intersectionRatio <= 0) return;
          io.unobserve(en.target);
          en.target.querySelectorAll('.pp-draw').forEach((path) => {
            path.classList.add('pp-play');
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

  const assetVars = {
    '--pp-plate-dark': `url(${voidFieldDark})`,
    '--pp-plate-light': `url(${voidFieldLight})`,
    '--pp-grain-dark': `url(${voidGrainDark})`,
    '--pp-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`pp-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'pp-motion-on' : 'pp-motion-reduced'}`}
      style={assetVars}
    >
      <PpVoidBackground />
      <div className="pp-frame">
        <PpProtocolHero
          selectedStage={selectedStage}
          onSelectStage={setSelectedStage}
          onScrollToMethod={scrollToMethod}
        />
        <PpQualification />
        <PpPilotPack />
        <PpMethod selectedStage={selectedStage} onSelectStage={setSelectedStage} />
        <PpScorecard />
        <PpDeliverables />
        <PpHandling />
        <FaqSection ns="partnersPilot" />
        <PpApplyForm />
      </div>
    </div>
  );
}
