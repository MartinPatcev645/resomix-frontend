import { useCallback, useEffect, useMemo } from 'react';
import { TiVoidBackground } from '@/sections/track-intelligence/TiVoidBackground.tsx';
import { TiAnatomyHero } from '@/sections/track-intelligence/TiAnatomyHero.tsx';
import { TiPassport } from '@/sections/track-intelligence/TiPassport.tsx';
import { TiStructuralScore } from '@/sections/track-intelligence/TiStructuralScore.tsx';
import { TiDynamicsChart } from '@/sections/track-intelligence/TiDynamicsChart.tsx';
import { TiHarmonicField } from '@/sections/track-intelligence/TiHarmonicField.tsx';
import { TiSpectralTerrain } from '@/sections/track-intelligence/TiSpectralTerrain.tsx';
import { TiIdentityMap } from '@/sections/track-intelligence/TiIdentityMap.tsx';
import { TiLensModes } from '@/sections/track-intelligence/TiLensModes.tsx';
import { TiProvenance } from '@/sections/track-intelligence/TiProvenance.tsx';
import { TiPlatformConnect } from '@/sections/track-intelligence/TiPlatformConnect.tsx';
import { TiFinalCta } from '@/sections/track-intelligence/TiFinalCta.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/track-intelligence/track-intelligence.css';

export default function TrackIntelligencePage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Track Intelligence — See What a Track Is Made Of | Resomix';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Draw-once motion — IO on HTML containers, not SVG paths
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const containers: Element[] = [];
    document.querySelectorAll('.ti-page .ti-draw').forEach((p) => {
      try {
        const path = p as SVGPathElement;
        const len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 800;
        path.style.strokeDasharray = String(len);
        path.style.setProperty('--len', String(len));
        path.style.strokeDashoffset = String(len);
        path.classList.add('ti-armed');
      } catch {
        /* non-path */
      }
      const host =
        p.closest('.ti-anatomy, .ti-bigviz, .ti-score-wrap, .ti-connect') || p.closest('section');
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
          en.target.querySelectorAll('.ti-draw').forEach((path) => {
            path.classList.add('ti-play');
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

  const scrollToStructure = useCallback(() => {
    document.getElementById('ti-structure')?.scrollIntoView({
      behavior: motionOn ? 'smooth' : 'auto',
      block: 'start',
    });
  }, [motionOn]);

  const scrollToProfile = useCallback(() => {
    document.getElementById('ti-profile')?.scrollIntoView({
      behavior: motionOn ? 'smooth' : 'auto',
      block: 'start',
    });
  }, [motionOn]);

  const assetVars = {
    '--ti-plate-dark': `url(${voidFieldDark})`,
    '--ti-plate-light': `url(${voidFieldLight})`,
    '--ti-grain-dark': `url(${voidGrainDark})`,
    '--ti-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`ti-page relative text-[var(--color-primary)] font-helvetica ${motionOn ? 'ti-motion-on' : 'ti-motion-reduced'}`}
      style={assetVars}
    >
      <TiVoidBackground />

      <div className="ti-frame">
        <TiAnatomyHero motionOn={motionOn} onScrollToStructure={scrollToStructure} />
        <TiPassport />
        <TiStructuralScore />
        <TiDynamicsChart />
        <TiHarmonicField />
        <TiSpectralTerrain />
        <TiIdentityMap />
        <TiLensModes onScrollToProfile={scrollToProfile} />
        <TiProvenance />
        <TiPlatformConnect />
        <TiFinalCta />
      </div>
    </div>
  );
}
