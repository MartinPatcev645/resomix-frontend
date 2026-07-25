import { useEffect, useMemo } from 'react';
import { VoidFieldBackground } from '@/sections/product/VoidFieldBackground.tsx';
import { WovenSignalHero } from '@/sections/product/WovenSignalHero.tsx';
import { PlatformOverview } from '@/sections/product/PlatformOverview.tsx';
import { SimilarityProof } from '@/sections/product/SimilarityProof.tsx';
import { AnalysisFragment } from '@/sections/product/AnalysisFragment.tsx';
import { CatalogueSchematic } from '@/sections/product/CatalogueSchematic.tsx';
import { ApiFlowBlock } from '@/sections/product/ApiFlowBlock.tsx';
import { AudienceRouter } from '@/sections/product/AudienceRouter.tsx';
import { CtaSplit } from '@/sections/product/CtaSplit.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import voidStructureProduct from '@/assets/void-field/void-structure-product.svg';
import voidStructureMobile from '@/assets/void-field/void-structure-mobile.svg';
import '@/sections/product/product.css';

export default function ProductPage() {
  const motionOn = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Interim SEO
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Product — Resomix';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const assetVars = {
    '--product-plate-dark': `url(${voidFieldDark})`,
    '--product-plate-light': `url(${voidFieldLight})`,
    '--product-grain-dark': `url(${voidGrainDark})`,
    '--product-grain-light': `url(${voidGrainLight})`,
    '--product-structure-product': `url(${voidStructureProduct})`,
    '--product-structure-mobile': `url(${voidStructureMobile})`,
  } as React.CSSProperties;

  return (
    <div
      className={`product-page relative text-[var(--color-primary)] font-helvetica ${motionOn ? 'product-motion-on' : 'product-motion-reduced'}`}
      style={assetVars}
    >
      <VoidFieldBackground />

      <div className="product-frame">
        <section className="product-section product-section-hero">
          <WovenSignalHero motionOn={motionOn} />
        </section>

        <section className="product-section">
          <PlatformOverview />
        </section>

        <section className="product-section">
          <SimilarityProof />
        </section>

        <section className="product-section">
          <AnalysisFragment motionOn={motionOn} />
        </section>

        <section className="product-section">
          <CatalogueSchematic />
        </section>

        <section className="product-section">
          <ApiFlowBlock />
        </section>

        <section className="product-section">
          <AudienceRouter />
        </section>

        <section className="product-section">
          <CtaSplit />
        </section>
      </div>
    </div>
  );
}
