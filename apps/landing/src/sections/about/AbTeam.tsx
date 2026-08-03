import { useTranslation } from 'react-i18next';

/* S11 · The team — Thessaloniki workbench composition; photography replacement zone, no fabricated people. */
export function AbTeam() {
  const { t } = useTranslation('common');
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-sec ab-section" id="ab-s11">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.team.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.team.h2')}</h2>
        <div className="ab-split">
          <div>
            <p className="ab-body-p">{t('about.team.body1')}</p>
            <p className="ab-body-p">{t('about.team.body2')}</p>
            <div className="ab-loc-lines">
              {t('about.team.location')}
              <br />
              <a href="mailto:support@resomix.com">{t('about.team.email')}</a>
            </div>
          </div>
          <div className="ab-stagebox" style={{ padding: '0' }}>
            <div className="ab-grain" aria-hidden="true" />
            <svg viewBox="0 0 560 320" role="img" aria-label={t('about.team.figureAria')}>
              <text x="40" y="44" fontSize="11" letterSpacing="1.6" fill="rgba(185,185,185,.92)">{f('coordinatesThessaloniki')}</text>
              <g fill="rgba(255,255,255,.12)">
                <rect x="40" y="64" width="30" height="18" /><rect x="78" y="64" width="30" height="18" /><rect x="116" y="64" width="30" height="18" /><rect x="154" y="64" width="30" height="18" />
                <rect x="40" y="90" width="30" height="18" /><rect x="116" y="90" width="30" height="18" /><rect x="154" y="90" width="30" height="18" />
              </g>
              <rect x="78" y="90" width="30" height="18" fill="rgba(238,74,38,.5)" />
              <text x="212" y="86" fontSize="9.5" letterSpacing="1.2" fill="rgba(185,185,185,.6)">{f('hardwareConsoleGrid')}</text>
              <line x1="40" y1="180" x2="520" y2="180" stroke="rgba(255,255,255,.36)" />
              <g stroke="rgba(255,255,255,.5)">
                <line x1="60" y1="172" x2="60" y2="188" /><line x1="280" y1="172" x2="280" y2="188" /><line x1="500" y1="172" x2="500" y2="188" />
              </g>
              <path className="ab-sig" d="M 60 180 H 500" fill="none" stroke="#EE4A26" strokeWidth="1.4" />
              <g fontSize="10.5" letterSpacing="1.1" fill="rgba(255,255,255,.92)">
                <text x="60" y="216" textAnchor="middle">{f('music')}</text><text x="60" y="230" textAnchor="middle">{f('practice')}</text>
                <text x="280" y="216" textAnchor="middle">{f('signal')}</text><text x="280" y="230" textAnchor="middle">{f('processing')}</text>
                <text x="500" y="216" textAnchor="middle">{f('product')}</text><text x="500" y="230" textAnchor="middle">{f('building')}</text>
              </g>
              <text x="40" y="290" fontSize="9" letterSpacing="1.2" fill="rgba(185,185,185,.5)">{f('teamPhotographyZone')}</text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
