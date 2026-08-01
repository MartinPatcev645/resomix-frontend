import { useEffect, useRef, type RefObject } from 'react';

/** IO-gated live class + optional scene-1 parallax (preview motion system). */
export function useSceneLive(
  motionOn: boolean,
  enableParallax: boolean,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const activate = () => el.classList.add('live');

    if (!motionOn || reduced) {
      activate();
      return;
    }

    if (!('IntersectionObserver' in window)) {
      activate();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('live');
          io.unobserve(e.target);
        });
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [motionOn]);

  useEffect(() => {
    if (!enableParallax || !motionOn) return;
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const plx = Array.from(el.querySelectorAll<SVGElement>('.plx'));
    if (!plx.length) return;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const p = Math.max(
          -1,
          Math.min(1, (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight),
        );
        plx.forEach((node) => {
          const f = parseFloat(node.getAttribute('data-plx') || '0');
          node.style.transform = `translateY(${(p * f * -26).toFixed(1)}px)`;
        });
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [motionOn, enableParallax]);

  return ref;
}
