import { useCallback, useEffect, useMemo, useState } from 'react';
import { SdVoidBackground } from '@/sections/sonic-discovery/SdVoidBackground.tsx';
import { SdSearchFieldHero } from '@/sections/sonic-discovery/SdSearchFieldHero.tsx';
import { SdSearchConsole } from '@/sections/sonic-discovery/SdSearchConsole.tsx';
import { SdDimensionBands } from '@/sections/sonic-discovery/SdDimensionBands.tsx';
import { SdShortlist } from '@/sections/sonic-discovery/SdShortlist.tsx';
import { SdAudienceModes } from '@/sections/sonic-discovery/SdAudienceModes.tsx';
import { SdProof } from '@/sections/sonic-discovery/SdProof.tsx';
import { SdFinalCta } from '@/sections/sonic-discovery/SdFinalCta.tsx';
import { type RefState, type Track } from '@/sections/sonic-discovery/sdEngine.ts';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/sonic-discovery/sonic-discovery.css';

export default function SonicDiscoveryPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const [heroSel, setHeroSel] = useState(0);
  const [refState, setRefState] = useState<RefState>({ ref: 'int', custom: null });
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [shortlist, setShortlist] = useState<Track[]>([]);
  const [audMode, setAudMode] = useState<'dj' | 'prod' | 'sup'>('dj');

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Sonic Discovery — Find Tracks by Sound, Not Tags | Resomix';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Draw-once motion — IO on HTML containers, not SVG paths (preview armDrawOnce)
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const containers: Element[] = [];
    document.querySelectorAll('.sd-page .sd-draw').forEach((p) => {
      try {
        const path = p as SVGPathElement;
        const len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 800;
        path.style.strokeDasharray = String(len);
        path.style.setProperty('--len', String(len));
        path.style.strokeDashoffset = String(len);
        path.classList.add('sd-armed');
      } catch {
        /* non-path */
      }
      const host =
        p.closest('.sd-hero-stagewrap, .sd-dimviz, .sd-refwave-wrap, .sd-flowwrap') ||
        p.closest('section');
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
          en.target.querySelectorAll('.sd-draw').forEach((path) => {
            path.classList.add('sd-play');
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

  const scrollToConsole = useCallback(() => {
    document.getElementById('sd-demo')?.scrollIntoView({
      behavior: motionOn ? 'smooth' : 'auto',
      block: 'start',
    });
  }, [motionOn]);

  const scrollToConsoleTop = useCallback(() => {
    document.getElementById('sd-stage-ref')?.scrollIntoView({
      behavior: motionOn ? 'smooth' : 'auto',
      block: 'start',
    });
  }, [motionOn]);

  const scrollToShortlist = useCallback(() => {
    document.getElementById('sd-playlist')?.scrollIntoView({
      behavior: motionOn ? 'smooth' : 'auto',
      block: 'nearest',
    });
  }, [motionOn]);

  const handleAddToShortlist = useCallback(
    (track: Track) => {
      setShortlist((prev) => (prev.some((p) => p.t === track.t) ? prev : [...prev, track]));
      scrollToShortlist();
    },
    [scrollToShortlist],
  );

  const handleChainDiscovery = useCallback(() => {
    setOpenRow(null);
  }, []);

  const handleReorder = useCallback((from: number, to: number) => {
    setShortlist((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  const handleRemove = useCallback((track: Track) => {
    setShortlist((prev) => prev.filter((p) => p.t !== track.t));
  }, []);

  const assetVars = {
    '--sd-plate-dark': `url(${voidFieldDark})`,
    '--sd-plate-light': `url(${voidFieldLight})`,
    '--sd-grain-dark': `url(${voidGrainDark})`,
    '--sd-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`sd-page relative text-[var(--color-primary)] font-helvetica ${motionOn ? 'sd-motion-on' : 'sd-motion-reduced'}`}
      style={assetVars}
    >
      <SdVoidBackground />

      <div className="sd-frame">
        <SdSearchFieldHero
          heroSel={heroSel}
          onSelectHero={setHeroSel}
          motionOn={motionOn}
          onScrollToConsole={scrollToConsole}
        />

        <SdSearchConsole
          refState={refState}
          onRefStateChange={setRefState}
          openRow={openRow}
          onOpenRowChange={setOpenRow}
          onAddToShortlist={handleAddToShortlist}
          onChainDiscovery={handleChainDiscovery}
          onScrollToConsoleTop={scrollToConsoleTop}
          motionOn={motionOn}
        />

        <SdDimensionBands />

        <SdShortlist
          shortlist={shortlist}
          onReorder={handleReorder}
          onRemove={handleRemove}
        />

        <SdAudienceModes
          mode={audMode}
          onModeChange={setAudMode}
          onScrollToConsole={scrollToConsole}
        />

        <SdProof />

        <SdFinalCta />
      </div>
    </div>
  );
}
