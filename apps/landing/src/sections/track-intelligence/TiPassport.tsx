import { useTranslation } from 'react-i18next';
import { TRACK, eAt, contourD, sectionBlocks } from './tiEngine.ts';

const MEASUREMENTS = [
  { key: 'tempo', tag: 'measured' as const },
  { key: 'key', tag: 'measured' as const },
  { key: 'loudness', tag: 'measured' as const },
  { key: 'duration', tag: 'measured' as const },
  { key: 'genre', tag: 'predicted' as const },
  { key: 'energy', tag: 'measured' as const },
  { key: 'mood', tag: 'predicted' as const },
];

export function TiPassport() {
  const { t } = useTranslation('common');
  const x0 = 4;
  const w = 372;
  const blocks = sectionBlocks(x0, 52, w, 30, false, -1);

  return (
    <section id="ti-profile" className="ti-section" aria-label="The track profile">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.profile.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.profile.title')}</h2>
        <p className="ti-lead">{t('trackIntelligence.profile.lead')}</p>
      </header>

      <div className="ti-passport">
        <div className="ti-pass-id">
          <div className="ti-art" aria-hidden="true">
            <svg width="38" height="38" viewBox="0 0 38 38">
              <path d="M7 27 V13 h4 v14 z M16 27 V8 h4 v19 z M25 27 V17 h4 v10 z" fill="#EE4A26" opacity="0.85" />
            </svg>
          </div>
          <div className="ti-pass-title">{TRACK.t}</div>
          <div className="ti-pass-artist">{TRACK.a}</div>
          <span className="ti-truth uppercase">{t('trackIntelligence.profile.betaSample')}</span>
          <div className="ti-pass-mini">
            <span className="ti-lbl uppercase">{t('trackIntelligence.profile.miniLabel')}</span>
            <svg
              viewBox="0 0 380 88"
              preserveAspectRatio="none"
              role="img"
              aria-label={t('trackIntelligence.profile.miniAlt')}
            >
              {blocks.map((b) => (
                <rect
                  key={b.label}
                  x={b.x}
                  y={52}
                  width={b.width}
                  height={30}
                  fill="none"
                  stroke={b.isDrop ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.3)'}
                  strokeWidth={1}
                />
              ))}
              <path
                d={contourD(eAt, x0, 8, w, 38, 0, 1)}
                stroke="#EE4A26"
                strokeWidth={1.4}
                fill="none"
                opacity={0.9}
              />
            </svg>
          </div>
        </div>

        <div
          className="ti-pass-score"
          role="table"
          aria-label={t('trackIntelligence.profile.tableAlt')}
        >
          {MEASUREMENTS.map((row) => (
            <div key={row.key} className="ti-scorerow" role="row">
              <span className="ti-k uppercase">{t(`trackIntelligence.profile.rows.${row.key}.label`)}</span>
              <span className="ti-v">
                {t(`trackIntelligence.profile.rows.${row.key}.value`)}{' '}
                <small>{t(`trackIntelligence.profile.rows.${row.key}.note`)}</small>
              </span>
              <span className={`ti-mtag ti-mtag-${row.tag === 'measured' ? 'm' : 'p'} uppercase`}>
                {row.tag === 'measured'
                  ? t('trackIntelligence.profile.measuredTag')
                  : t('trackIntelligence.profile.predictedTag')}
              </span>
            </div>
          ))}
        </div>

        <div className="ti-pass-read">
          <span className="ti-lbl uppercase">{t('trackIntelligence.profile.interpLabel')}</span>
          <p className="ti-interp">{t('trackIntelligence.profile.interp')}</p>
          <span className="ti-truth uppercase">{t('trackIntelligence.profile.interpTruth')}</span>
        </div>
      </div>
    </section>
  );
}
