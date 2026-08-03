import { useEffect, useMemo } from 'react';
import { PoDefsProvider, PoSharedDefs } from '@/sections/product/PoSharedDefs.tsx';
import { PoHero } from '@/sections/product/PoHero.tsx';
import { PoProducts } from '@/sections/product/PoProducts.tsx';
import { PoProfile } from '@/sections/product/PoProfile.tsx';
import { PoDiscovery } from '@/sections/product/PoDiscovery.tsx';
import { PoAnatomy } from '@/sections/product/PoAnatomy.tsx';
import { PoCatalogue } from '@/sections/product/PoCatalogue.tsx';
import { PoApi } from '@/sections/product/PoApi.tsx';
import { PoPathways } from '@/sections/product/PoPathways.tsx';
import { PoTrust } from '@/sections/product/PoTrust.tsx';
import { PoClosing } from '@/sections/product/PoClosing.tsx';
import '@/sections/product/product.css';


export default function ProductPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Draw-once reveal: sections go .live on first intersection, then unobserve.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('.po-page .po-section'));
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

  // Optional hero parallax for .po-plx (preview may have none — safe no-op).
  useEffect(() => {
    if (!motionOn) return;
    const heroes = Array.from(document.querySelectorAll<HTMLElement>('.po-page .po-hero'));
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
          hero.querySelectorAll<SVGElement>('.po-plx').forEach((node) => {
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
    <div className={`po-page relative font-helvetica font-light ${motionOn ? 'po-motion-on' : 'po-motion-reduced'}`}>
      <PoDefsProvider>
        <PoSharedDefs />
        <main>
          <PoHero />
          <PoProducts />
          <PoProfile />
          <PoDiscovery />
          <PoAnatomy />
          <PoCatalogue />
          <PoApi />
          <PoPathways />
          <PoTrust />
          <PoClosing />
        </main>
      </PoDefsProvider>
    </div>
  );
}
