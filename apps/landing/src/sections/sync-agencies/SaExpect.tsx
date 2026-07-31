import { useTranslation } from 'react-i18next';

export function SaExpect() {
  const { t } = useTranslation('common');

  return (
    <section className="sa-section" id="sa-expect">
      <div className="sa-frame">
        <div className="sa-ex-grid">
          <div>
            <p className="sa-eyebrow uppercase">{t('syncAgencies.expect.eyebrow')}</p>
            <h2 className="sa-h2b uppercase">{t('syncAgencies.expect.h2')}</h2>
            <p className="sa-body">{t('syncAgencies.expect.p1')}</p>
            <p className="sa-ex-lateral">{t('syncAgencies.expect.p2')}</p>
            <p className="sa-body">{t('syncAgencies.expect.p3')}</p>
          </div>

          <figure
            className="sa-fig"
            role="img"
            aria-label={t('syncAgencies.expect.figureAria')}
          >
            {/* Illustrative — fictional catalogue field; expected path, lateral thread, gap, human choice. */}
            <svg className="sa-sl" viewBox="0 0 560 380" aria-hidden="true">
              <text x="32" y="38" style={{ fontSize: '11px' }}>
                {t('syncAgencies.figures.yourCatalogue')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.28)' }}>
                <circle cx="90" cy="200" r="2.6" />
                <circle cx="130" cy="184" r="2.6" />
                <circle cx="166" cy="208" r="2.6" />
                <circle cx="120" cy="230" r="2.6" />
                <circle cx="200" cy="192" r="2.6" />
                <circle cx="238" cy="214" r="2.6" />
                <circle cx="276" cy="198" r="2.6" />
                <circle cx="312" cy="220" r="2.6" />
                <circle cx="350" cy="204" r="2.6" />
                <circle cx="388" cy="222" r="2.6" />
                <circle cx="426" cy="206" r="2.6" />
                <circle cx="180" cy="256" r="2.6" />
                <circle cx="260" cy="262" r="2.6" />
                <circle cx="340" cy="258" r="2.6" />
                <circle cx="420" cy="264" r="2.6" />
                <circle cx="150" cy="120" r="2.6" />
                <circle cx="196" cy="102" r="2.6" />
                <circle cx="240" cy="126" r="2.6" />
                <circle cx="300" cy="96" r="2.6" />
                <circle cx="358" cy="118" r="2.6" />
                <circle cx="420" cy="100" r="2.6" />
              </g>
              <path d="M90 200 H426" style={{ color: 'rgba(255,255,255,.22)' }} />
              <text x="330" y="244" style={{ fontSize: '10px' }}>
                {t('syncAgencies.figures.expectedPath')}
              </text>
              <path
                className="sa-dashflow"
                d="M90 200 C 160 90 330 48 470 96"
                style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.8 }}
              />
              <circle className="sa-glowp" cx="478" cy="100" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
              <circle cx="478" cy="100" r="10" style={{ color: 'rgba(238,74,38,.4)', strokeWidth: 1.6 }} />
              <text x="410" y="66" style={{ fontSize: '10.5px', fill: '#EE4A26' }}>
                {t('syncAgencies.figures.hiddenGem')}
              </text>
              <circle
                cx="250"
                cy="330"
                r="26"
                strokeDasharray="4 6"
                style={{ color: 'rgba(255,255,255,.3)' }}
              />
              <text x="290" y="336" style={{ fontSize: '10px' }}>
                {t('syncAgencies.figures.gapNoted')}
              </text>
              <circle cx="478" cy="100" r="16" style={{ color: 'rgba(255,255,255,.85)', strokeWidth: 1.8 }} />
              <text x="452" y="146" style={{ fontSize: '10.5px', fill: '#d8d8d8' }}>
                {t('syncAgencies.figures.yourCall')}
              </text>
            </svg>
            <figcaption>
              <span>{t('syncAgencies.figures.engineThinksLaterally')}</span>
              <span>{t('syncAgencies.figures.youStayInControl')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
