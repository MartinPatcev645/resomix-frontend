import { useTranslation } from 'react-i18next';

export function PpPilotPack() {
  const { t } = useTranslation('common');

  const items = t('partnersPilot.pilotPack.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  return (
    <section id="prepare" aria-label="What to prepare" className="pp-section">
      <header className="pp-dim-intro">
        <p className="pp-eyebrow uppercase">{t('partnersPilot.pilotPack.eyebrow')}</p>
        <h2 className="pp-h2b uppercase">{t('partnersPilot.pilotPack.title')}</h2>
        <p className="pp-lead">{t('partnersPilot.pilotPack.lead')}</p>
      </header>
      <div className="pp-pack">
        {items.map((item) => (
          <div key={item.title} className="pp-packitem">
            <span className="pp-pack-bx" aria-hidden="true">
              ▢
            </span>
            <span>
              <span className="pp-pack-t uppercase">{item.title}</span>
              <p>{item.body}</p>
            </span>
          </div>
        ))}
      </div>
      <p className="pp-lbl-dim pp-pack-note uppercase">{t('partnersPilot.pilotPack.footnote')}</p>
    </section>
  );
}
