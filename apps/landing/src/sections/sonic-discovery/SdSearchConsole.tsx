import { useTranslation } from 'react-i18next';
import { SdFlowPanel } from '@/sections/sonic-discovery/scenes/SdFlowPanel.tsx';

interface SdSearchConsoleProps {
  motionOn: boolean;
}

export function SdSearchConsole({ motionOn }: SdSearchConsoleProps) {
  const { t } = useTranslation('common');

  return (
    <section id="sd-demo" className="sd-section" aria-label="Sonic search console schematic">
      <div className="sd-col">
        <header className="sd-dim-intro">
          <p className="sd-eyebrow uppercase">{t('sonicDiscovery.console.eyebrow')}</p>
          <h2 className="sd-h2b uppercase">{t('sonicDiscovery.console.title')}</h2>
          <p className="sd-lead">{t('sonicDiscovery.console.lead')}</p>
        </header>
      </div>

      <SdFlowPanel motionOn={motionOn} />
    </section>
  );
}
