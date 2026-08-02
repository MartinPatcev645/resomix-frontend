import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/* S5 · Track Anatomy Console. */
export function PoAnatomy() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const f = (key: string) => t(`product.figures.${key}`);

  return (
    <section className="po-sec po-section" id="po-s5">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.anatomy.eyebrow')}</div>
        <h2 className="po-h2">{t('product.anatomy.h2')}</h2>
        <div className="po-copycol">
          <p className="po-body-p">{t('product.anatomy.body1')}</p>
          <p className="po-body-p">{t('product.anatomy.body2')}</p>
        </div>
        <div className="po-cta-row">
          <button type="button" className="po-btn" onClick={() => navigate('/product/track-intelligence')}>
            {t('product.anatomy.cta')}
          </button>
        </div>
      </div>

      <div className="po-wrap po-bleed po-fig">
        <div className="po-stagebox">
          <div className="po-grain" aria-hidden="true" />

                {/* ============ TRACK ANATOMY CONSOLE · DESKTOP ============ */}
                <svg className="po-d-only" viewBox="0 0 1200 420" role="img"
                     aria-label={t('product.anatomy.figureAriaD')}>
                  <rect x="40" y="24" width="1120" height="372" fill="#141416" stroke="rgba(255,255,255,.44)"/>
                  <text x="64" y="56" fontSize="10" letterSpacing="2" fill="rgba(255,255,255,.97)">{f('stillCurrentRec')}</text>
                  <text x="1136" y="56" fontSize="8" letterSpacing="1.2" textAnchor="end" fill="rgba(185,185,185,.76)">{f('illustrativeTiView')}</text>

                  {/* structural regions */}
                  <g fontSize="7.5" letterSpacing="1.2" fill="rgba(185,185,185,.82)">
                    <rect x="64"  y="76" width="150" height="14" fill="rgba(255,255,255,.11)"/><text x="70" y="87">{f('intro')}</text>
                    <rect x="216" y="76" width="230" height="14" fill="rgba(255,255,255,.16)"/><text x="222" y="87">{f('build')}</text>
                    <rect x="448" y="76" width="260" height="14" fill="rgba(238,74,38,.36)"/><text x="454" y="87" fill="rgba(255,255,255,.9)">{f('drop')}</text>
                    <rect x="710" y="76" width="180" height="14" fill="rgba(255,255,255,.13)"/><text x="716" y="87">{f('breakdown')}</text>
                    <rect x="892" y="76" width="244" height="14" fill="rgba(255,255,255,.11)"/><text x="898" y="87">{f('outro')}</text>
                  </g>

                  {/* energy bands + curve */}
                  <g fontSize="7" letterSpacing="1" fill="rgba(185,185,185,.72)">
                    <text x="52" y="128" textAnchor="end">{f('high')}</text>
                    <text x="52" y="180" textAnchor="end">{f('med')}</text>
                    <text x="52" y="232" textAnchor="end">{f('low')}</text>
                  </g>
                  <g stroke="rgba(255,255,255,.13)"><line x1="64" y1="124" x2="1136" y2="124"/>
                    <line x1="64" y1="176" x2="1136" y2="176"/><line x1="64" y1="228" x2="1136" y2="228"/></g>
                  <path d="M 64 226 C 140 222, 190 212, 216 204 C 300 184, 380 166, 448 142
                           C 500 126, 560 120, 620 122 C 668 124, 700 130, 708 134
                           C 760 160, 800 190, 890 196 C 960 200, 1050 214, 1136 222"
                        fill="none" stroke="#EE4A26" strokeWidth="2.4"/>
                  <circle cx="560" cy="120" r="3.4" fill="#EE4A26"/>
                  <text x="560" y="110" fontSize="7.5" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.9)">{f('peak312')}</text>

                  {/* time axis */}
                  <line x1="64" y1="248" x2="1136" y2="248" stroke="rgba(255,255,255,.28)"/>
                  <g fontSize="7" letterSpacing="1" fill="rgba(185,185,185,.76)">
                    <text x="64" y="264">{f('t000')}</text><text x="332" y="264">{f('t145')}</text><text x="600" y="264">{f('t330')}</text>
                    <text x="868" y="264">{f('t515')}</text><text x="1112" y="264">{f('t700')}</text>
                  </g>

                  {/* interpretation */}
                  <text x="64" y="292" fontSize="8.5" letterSpacing="1" fill="rgba(185,185,185,.88)">{f('interpretation')}</text>

                  {/* supporting modules */}
                  <g fontSize="7.5" letterSpacing="1">
                    <rect x="64" y="310" width="200" height="52" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="76" y="328" fill="rgba(185,185,185,.76)">{f('rhythmTempo')}</text>
                    <text x="76" y="346" fill="rgba(255,255,255,.94)">{f('bpmSteadyGrid')}</text>
                    <rect x="282" y="310" width="200" height="52" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="294" y="328" fill="rgba(185,185,185,.76)">{f('keyHarmony')}</text>
                    <text x="294" y="346" fill="rgba(255,255,255,.94)">{f('fMinor8aStable')}</text>
                    <rect x="500" y="310" width="200" height="52" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="512" y="328" fill="rgba(185,185,185,.76)">{f('timbreSpectral')}</text>
                    <text x="512" y="346" fill="rgba(255,255,255,.94)">{f('darkMidFocused')}</text>
                    <rect x="718" y="310" width="200" height="52" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="730" y="328" fill="rgba(185,185,185,.76)">{f('moodStyle')}</text>
                    <text x="730" y="346" fill="rgba(255,255,255,.94)">{f('hypnoticLateNight')}</text>
                    <rect x="936" y="310" width="200" height="52" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="948" y="328" fill="rgba(185,185,185,.76)">{f('confidence')}</text>
                    <text x="948" y="346" fill="rgba(255,255,255,.94)">{f('keyTempoConf')}</text>
                  </g>
                  <text x="64" y="388" fontSize="7.5" letterSpacing="1.2" fill="rgba(185,185,185,.8)">{f('audioDerived')}</text>
                </svg>

                {/* ============ TRACK ANATOMY CONSOLE · MOBILE ============ */}
                <svg className="po-m-only" viewBox="0 0 390 520" role="img"
                     aria-label={t('product.anatomy.figureAriaM')}>
                  <rect x="16" y="16" width="358" height="488" fill="#141416" stroke="rgba(255,255,255,.44)"/>
                  <text x="32" y="42" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.97)">{f('stillCurrentRec')}</text>
                  <text x="32" y="58" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.76)">{f('illustrativeTiView')}</text>
                  <g fontSize="6.4" letterSpacing=".8" fill="rgba(185,185,185,.82)">
                    <rect x="32" y="72" width="52" height="11" fill="rgba(255,255,255,.07)"/><text x="36" y="81">{f('intro')}</text>
                    <rect x="86" y="72" width="76" height="11" fill="rgba(255,255,255,.11)"/><text x="90" y="81">{f('build')}</text>
                    <rect x="164" y="72" width="86" height="11" fill="rgba(238,74,38,.28)"/><text x="168" y="81" fill="rgba(255,255,255,.9)">{f('drop')}</text>
                    <rect x="252" y="72" width="56" height="11" fill="rgba(255,255,255,.09)"/><text x="256" y="81">{f('brkdn')}</text>
                    <rect x="310" y="72" width="48" height="11" fill="rgba(255,255,255,.07)"/><text x="314" y="81">{f('outro')}</text>
                  </g>
                  <g fontSize="6.4" letterSpacing=".8" fill="rgba(185,185,185,.72)">
                    <text x="32" y="110">{f('high')}</text><text x="32" y="150">{f('med')}</text><text x="32" y="190">{f('low')}</text>
                  </g>
                  <g stroke="rgba(255,255,255,.13)"><line x1="60" y1="106" x2="358" y2="106"/>
                    <line x1="60" y1="146" x2="358" y2="146"/><line x1="60" y1="186" x2="358" y2="186"/></g>
                  <path d="M 60 184 C 100 180, 130 168, 164 150 C 190 138, 216 104, 238 104 C 258 106, 280 130, 308 158 C 330 176, 346 180, 358 182"
                        fill="none" stroke="#EE4A26" strokeWidth="2.2"/>
                  <circle cx="238" cy="104" r="3" fill="#EE4A26"/>
                  <text x="238" y="96" fontSize="6.6" letterSpacing=".8" textAnchor="middle" fill="rgba(255,255,255,.9)">{f('peak312')}</text>
                  <line x1="32" y1="204" x2="358" y2="204" stroke="rgba(255,255,255,.28)"/>
                  <g fontSize="6.4" letterSpacing=".8" fill="rgba(185,185,185,.76)">
                    <text x="32" y="218">{f('t000')}</text><text x="186" y="218">{f('t330')}</text><text x="336" y="218">{f('t700')}</text>
                  </g>
                  <g fontSize="7" letterSpacing=".8" fill="rgba(185,185,185,.88)">
                    <text x="32" y="244">{f('interpretationM1')}</text>
                    <text x="32" y="258">{f('interpretationM2')}</text>
                    <text x="32" y="272">{f('interpretationM3')}</text>
                  </g>
                  <g fontSize="6.8" letterSpacing=".8">
                    <rect x="32" y="288" width="158" height="42" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="42" y="304" fill="rgba(185,185,185,.76)">{f('rhythmTempo')}</text><text x="42" y="318" fill="rgba(255,255,255,.94)">{f('bpmSteady')}</text>
                    <rect x="200" y="288" width="158" height="42" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="210" y="304" fill="rgba(185,185,185,.76)">{f('keyHarmony')}</text><text x="210" y="318" fill="rgba(255,255,255,.94)">{f('fMinor8a')}</text>
                    <rect x="32" y="338" width="158" height="42" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="42" y="354" fill="rgba(185,185,185,.76)">{f('timbreSpectral')}</text><text x="42" y="368" fill="rgba(255,255,255,.94)">{f('darkMidFocused')}</text>
                    <rect x="200" y="338" width="158" height="42" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="210" y="354" fill="rgba(185,185,185,.76)">{f('moodStyle')}</text><text x="210" y="368" fill="rgba(255,255,255,.94)">{f('hypnotic')}</text>
                    <rect x="32" y="388" width="326" height="42" fill="none" stroke="rgba(255,255,255,.28)"/>
                    <text x="42" y="404" fill="rgba(185,185,185,.76)">{f('confidence')}</text><text x="42" y="418" fill="rgba(255,255,255,.94)">{f('keyTempoConf')}</text>
                  </g>
                  <text x="32" y="462" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.8)">{f('audioDerivedM1')}</text>
                  <text x="32" y="476" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.8)">{f('audioDerivedM2')}</text>
                </svg>
        </div>
      </div>
    </section>
  );
}
