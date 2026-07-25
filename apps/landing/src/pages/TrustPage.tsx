import { useEffect } from 'react';
import { TrVoidBackground } from '@/sections/trust/TrVoidBackground.tsx';
import { TrHero } from '@/sections/trust/TrHero.tsx';
import { TrGlanceLedger } from '@/sections/trust/TrGlanceLedger.tsx';
import { TrLifecycles } from '@/sections/trust/TrLifecycles.tsx';
import { TrRightsQA } from '@/sections/trust/TrRightsQA.tsx';
import { TrSecurityLedger } from '@/sections/trust/TrSecurityLedger.tsx';
import { TrProviders } from '@/sections/trust/TrProviders.tsx';
import { TrRetention } from '@/sections/trust/TrRetention.tsx';
import { TrLegalContact } from '@/sections/trust/TrLegalContact.tsx';
import voidFieldDark from '@/assets/void-field/void-field-dark.webp';
import voidFieldLight from '@/assets/void-field/void-field-light.webp';
import voidGrainDark from '@/assets/void-field/void-grain-dark.png';
import voidGrainLight from '@/assets/void-field/void-grain-light.png';
import '@/sections/trust/trust.css';

export default function TrustPage() {
  // Interim SEO — open decision, IMPLEMENTATION_RULES §36.1
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Trust, Rights & Security — How Resomix Handles Audio and Data';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const assetVars = {
    '--tr-plate-dark': `url(${voidFieldDark})`,
    '--tr-plate-light': `url(${voidFieldLight})`,
    '--tr-grain-dark': `url(${voidGrainDark})`,
    '--tr-grain-light': `url(${voidGrainLight})`,
  } as React.CSSProperties;

  return (
    <div
      className="tr-page relative text-[var(--color-primary)] font-helvetica font-light"
      style={assetVars}
    >
      <TrVoidBackground />
      <div className="tr-frame">
        <main className="tr-main">
          <TrHero />
          <TrGlanceLedger />
          <TrLifecycles />
          <TrRightsQA />
          <TrSecurityLedger />
          <TrProviders />
          <TrRetention />
          <TrLegalContact />
        </main>
      </div>
    </div>
  );
}
