import { useTranslation } from 'react-i18next';

const PROV_ROWS = [
  'engine',
  'analysisDate',
  'sourceDuration',
  'scope',
  'keyConfidence',
  'qualityWarnings',
  'dataStatus',
] as const;

export function TiProvenance() {
  const { t } = useTranslation('common');
  const statements = t('trackIntelligence.confidence.statements', { returnObjects: true }) as string[];

  return (
    <section id="ti-confidence" className="ti-section" aria-label="Confidence, context and interpretation">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.confidence.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.confidence.title')}</h2>
        <p className="ti-lead">{t('trackIntelligence.confidence.lead')}</p>
      </header>

      <div className="ti-prov">
        <ul className="ti-provlist">
          {statements.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="ti-hud ti-provpanel ti-hudpad">
          <span className="ti-hudlbl ti-hudtop-l uppercase">{t('trackIntelligence.confidence.panelLabel')}</span>
          {PROV_ROWS.map((key) => (
            <div key={key} className="ti-row">
              <span className="ti-k uppercase">{t(`trackIntelligence.confidence.provenance.${key}.label`)}</span>
              <span
                className={`ti-v${key === 'dataStatus' ? ' ti-v-orange' : ''}`}
              >
                {t(`trackIntelligence.confidence.provenance.${key}.value`)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
