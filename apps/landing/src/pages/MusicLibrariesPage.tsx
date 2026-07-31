import { useEffect, useMemo } from 'react';
import { MlVoidBackground } from '@/sections/music-libraries/MlVoidBackground.tsx';
import { MlHero } from '@/sections/music-libraries/MlHero.tsx';
import { MlStatement } from '@/sections/music-libraries/MlStatement.tsx';
import { MlTags } from '@/sections/music-libraries/MlTags.tsx';
import { MlValues } from '@/sections/music-libraries/MlValues.tsx';
import { MlLost } from '@/sections/music-libraries/MlLost.tsx';
import { MlFinalCta } from '@/sections/music-libraries/MlFinalCta.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/music-libraries/music-libraries.css';

export default function MusicLibrariesPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1
  useEffect(() => {
    const previousTitle = document.title;
    document.title =
      'Music Libraries & Sample Providers — Turn Your Catalogue Into a Sonic Discovery Engine | Resomix';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  // Continuous animations only while the owning section is in viewport
  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const sections = Array.from(document.querySelectorAll('.ml-page .ml-section'));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('ml-anim');
          } else {
            en.target.classList.remove('ml-anim');
          }
        });
      },
      { threshold: 0.05 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [motionOn]);

  const assetVars = {
    '--ml-plate-dark': `url(${voidFieldDark})`,
    '--ml-plate-light': `url(${voidFieldLight})`,
    '--ml-grain-dark': `url(${voidGrainDark})`,
    '--ml-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className={`ml-page relative text-[var(--color-primary)] font-helvetica font-light ${motionOn ? 'ml-motion-on' : 'ml-motion-reduced'}`}
      style={assetVars}
    >
      <MlVoidBackground />
      <main>
        <MlHero />
        <MlStatement />
        <MlTags />
        <MlValues />
        <MlLost />
        <MlFinalCta />
      </main>
    </div>
  );
}
