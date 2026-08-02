import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePoDefs } from './poDefs.ts';

/* S6 · Bounded catalogue query. */
export function PoCatalogue() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = usePoDefs();
  const f = (key: string) => t(`product.figures.${key}`);

  return (
    <section className="po-sec po-section" id="po-s6">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.catalogue.eyebrow')}</div>
        <h2 className="po-h2">{t('product.catalogue.h2')}</h2>
        <div className="po-copycol">
          <p className="po-body-p">{t('product.catalogue.body1')}</p>
          <p className="po-body-p">{t('product.catalogue.body2')}</p>
        </div>
        <div className="po-cta-row">
          <button type="button" className="po-btn" onClick={() => navigate('/product/catalog-intelligence')}>
            {t('product.catalogue.cta')}
          </button>
        </div>
      </div>

      <div className="po-wrap po-bleed po-fig">
        <div className="po-stagebox">
          <div className="po-grain" aria-hidden="true" />

                {/* ============ BOUNDED CATALOGUE QUERY · DESKTOP ============ */}
                <svg className="po-d-only" viewBox="0 0 1200 360" role="img"
                     aria-label={t('product.catalogue.figureAriaD')}>
                  <path d="M 50 96 h 148 l 10 10 v 44 h -158 z" fill="#17171A" stroke="rgba(255,255,255,.28)"/>
                  <text x="62" y="120" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.95)">{f('authorisedAudio')}</text>
                  <text x="62" y="134" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.95)">{f('agreedMetadata')}</text>
                  <line x1="208" y1="122" x2="256" y2="122" stroke="rgba(255,255,255,.46)"/>
                  <g>
                    <circle cx="290" cy="122" r="16" fill="none" stroke="rgba(255,255,255,.5)"
                            strokeDasharray="64 36" transform="rotate(30 290 122)"/>
                    <rect x="285" y="117" width="10" height="10" fill="#0C0C0D" stroke="rgba(238,74,38,.85)" transform="rotate(45 290 122)"/>
                  </g>
                  <text x="290" y="160" fontSize="8" letterSpacing="1.1" textAnchor="middle" fill="rgba(255,255,255,.94)">{f('pyxis')}</text>
                  <text x="290" y="174" fontSize="8" letterSpacing="1.1" textAnchor="middle" fill="rgba(255,255,255,.94)">{f('preProcessing')}</text>
                  <line x1="308" y1="122" x2="356" y2="122" stroke="rgba(255,255,255,.46)"/>

                  {/* heavy partner boundary */}
                  <g>
                    <rect x="368" y="44" width="330" height="240" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2"/>
                    <text x="368" y="32" fontSize="9.5" letterSpacing="1.8" fill="rgba(255,255,255,.95)">{f('partnerScopedIndex')}</text>
                    <rect x="384" y="60" width="240" height="170" fill={url('cells')}/>
                    <rect x="384" y="60" width="240" height="170" fill={url('cellsMark')}/>
                    <text x="384" y="252" fontSize="8" letterSpacing="1" fill="rgba(185,185,185,.85)">{f('storedSonicProfiles')}</text>
                    <text x="384" y="268" fontSize="8" letterSpacing="1" fill="rgba(185,185,185,.82)">{f('onePartnerBoundary')}</text>
                  </g>

                  {/* reference query */}
                  <circle cx="480" cy="330" r="16" fill={url('halo')}/>
                  <rect x="470" y="324" width="20" height="12" fill="#EE4A26"/>
                  <text x="504" y="334" fontSize="8.5" letterSpacing="1.1" fill="rgba(255,255,255,.95)">{f('referenceQuery')}</text>
                  <path className="po-sig" d="M 480 322 V 286" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

                  <path className="po-sig" d="M 698 130 C 750 128, 790 126, 838 124" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

                  {/* ranked partner results */}
                  <g>
                    <rect x="850" y="56" width="260" height="150" fill="#1C1C1F" stroke="rgba(255,255,255,.28)"/>
                    <text x="866" y="80" fontSize="8.5" letterSpacing="1.2" fill="rgba(255,255,255,.96)">{f('rankedPartnerResults')}</text>
                    <g fontSize="8" letterSpacing="1">
                      <g className="po-resolve d1"><rect x="858" y="90" width="244" height="18" fill="rgba(238,74,38,.12)"/>
                        <text x="866" y="103" fill="#EE4A26">{f('rank01')}</text><text x="896" y="103" fill="rgba(255,255,255,.95)">{f('cat0417Id')}</text><text x="1094" y="103" textAnchor="end" fill="rgba(238,74,38,.9)">{f('score931')}</text></g>
                      <g className="po-resolve d2"><text x="866" y="126" fill="rgba(255,255,255,.76)">{f('rank02')}</text><text x="896" y="126" fill="rgba(255,255,255,.94)">{f('cat1121Id')}</text><text x="1094" y="126" textAnchor="end" fill="rgba(185,185,185,.8)">{f('score924')}</text></g>
                      <g className="po-resolve d3"><text x="866" y="148" fill="rgba(255,255,255,.73)">{f('rank03')}</text><text x="896" y="148" fill="rgba(255,255,255,.9)">{f('cat0088Id')}</text><text x="1094" y="148" textAnchor="end" fill="rgba(185,185,185,.76)">{f('score918')}</text></g>
                      <g className="po-resolve d4"><text x="866" y="170" fill="rgba(255,255,255,.7)">{f('rank04')}</text><text x="896" y="170" fill="rgba(255,255,255,.86)">{f('rec1c44')}</text><text x="1094" y="170" textAnchor="end" fill="rgba(185,185,185,.72)">{f('score912')}</text></g>
                      <g className="po-resolve d5"><text x="866" y="192" fill="rgba(255,255,255,.67)">{f('rank05')}</text><text x="896" y="192" fill="rgba(255,255,255,.83)">{f('cat1388')}</text><text x="1094" y="192" textAnchor="end" fill="rgba(185,185,185,.45)">{f('score909')}</text></g>
                    </g>
                  </g>

                  {/* separate track intelligence option */}
                  <path d="M 1102 103 C 1130 110, 1140 130, 1140 150" fill="none" stroke="rgba(255,255,255,.42)"/>
                  <rect x="1010" y="230" width="150" height="40" fill="none" stroke="rgba(255,255,255,.34)"/>
                  <path d="M 1140 190 V 230" fill="none" stroke="rgba(255,255,255,.42)"/>
                  <text x="1085" y="248" fontSize="7.5" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.86)">{f('openTrackIntelligence')}</text>
                  <text x="1085" y="262" fontSize="7" letterSpacing=".9" textAnchor="middle" fill="rgba(185,185,185,.72)">{f('oneRecordingSeparate')}</text>

                  {/* trust labels */}
                  <g fontSize="7.5" letterSpacing="1.1" fill="rgba(185,185,185,.85)">
                    </g>
                  <text x="368" y="330" fontSize="8" letterSpacing="1.1" fill="rgba(185,185,185,.85)">{f('noSharedCataloguePool')}</text>
                  <text x="698" y="330" fontSize="8" letterSpacing="1.1" textAnchor="end" fill="rgba(185,185,185,.85)">{f('automaticRanking')}</text>
                  <text x="850" y="330" fontSize="8" letterSpacing="1.1" fill="rgba(185,185,185,.85)">{f('partnerKeepsControl')}</text>
                </svg>

                {/* ============ BOUNDED CATALOGUE QUERY · MOBILE ============ */}
                <svg className="po-m-only" viewBox="0 0 390 620" role="img"
                     aria-label={t('product.catalogue.figureAriaM')}>
                  <path d="M 24 20 h 240 l 8 8 v 36 h -248 z" fill="#17171A" stroke="rgba(255,255,255,.28)"/>
                  <text x="36" y="42" fontSize="7.8" letterSpacing="1" fill="rgba(255,255,255,.95)">{f('authorisedAudioMeta')}</text>
                  <path className="po-sig" d="M 148 64 V 92" fill="none" stroke="#EE4A26" strokeWidth="1.4"/>
                  <circle cx="148" cy="108" r="13" fill="none" stroke="rgba(255,255,255,.5)" strokeDasharray="52 30" transform="rotate(30 148 108)"/>
                  <rect x="144" y="104" width="8" height="8" fill="#0C0C0D" stroke="rgba(238,74,38,.85)" transform="rotate(45 148 108)"/>
                  <text x="172" y="112" fontSize="7.8" letterSpacing="1" fill="rgba(255,255,255,.94)">{f('pyxisPreProcessingFull')}</text>
                  <path className="po-sig" d="M 148 124 V 150" fill="none" stroke="#EE4A26" strokeWidth="1.4"/>

                  <rect x="24" y="156" width="342" height="170" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2"/>
                  <text x="24" y="146" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.95)">{f('partnerScopedIndex')}</text>
                  <rect x="38" y="170" width="200" height="120" fill={url('cells')}/>
                  <rect x="38" y="170" width="200" height="120" fill={url('cellsMark')}/>
                  <text x="252" y="192" fontSize="7.2" letterSpacing=".9" fill="rgba(185,185,185,.85)">{f('stored')}</text>
                  <text x="252" y="205" fontSize="7.2" letterSpacing=".9" fill="rgba(185,185,185,.85)">{f('sonic')}</text>
                  <text x="252" y="218" fontSize="7.2" letterSpacing=".9" fill="rgba(185,185,185,.85)">{f('profiles')}</text>
                  <text x="38" y="312" fontSize="7.4" letterSpacing=".9" fill="rgba(185,185,185,.82)">{f('onePartnerBoundary')}</text>

                  <circle cx="330" cy="352" r="13" fill={url('halo')}/>
                  <rect x="322" y="347" width="16" height="10" fill="#EE4A26"/>
                  <text x="310" y="376" fontSize="7.4" letterSpacing=".9" textAnchor="end" fill="rgba(255,255,255,.95)">{f('referenceQuery')}</text>
                  <path className="po-sig" d="M 330 344 V 326" fill="none" stroke="#EE4A26" strokeWidth="1.4"/>

                  <path className="po-sig" d="M 195 326 V 396" fill="none" stroke="#EE4A26" strokeWidth="1.4"/>
                  <rect x="24" y="402" width="342" height="130" fill="#1C1C1F" stroke="rgba(255,255,255,.28)"/>
                  <text x="40" y="424" fontSize="8" letterSpacing="1.1" fill="rgba(255,255,255,.96)">{f('rankedPartnerResults')}</text>
                  <g fontSize="7.6" letterSpacing=".9">
                    <g className="po-resolve d1"><rect x="32" y="432" width="326" height="17" fill="rgba(238,74,38,.12)"/>
                      <text x="40" y="444" fill="#EE4A26">{f('rank01')}</text><text x="66" y="444" fill="rgba(255,255,255,.95)">{f('cat0417Id')}</text><text x="350" y="444" textAnchor="end" fill="rgba(238,74,38,.9)">{f('score931')}</text></g>
                    <g className="po-resolve d2"><text x="40" y="464" fill="rgba(255,255,255,.76)">{f('rank02')}</text><text x="66" y="464" fill="rgba(255,255,255,.94)">{f('cat1121Id')}</text><text x="350" y="464" textAnchor="end" fill="rgba(185,185,185,.8)">{f('score924')}</text></g>
                    <g className="po-resolve d3"><text x="40" y="482" fill="rgba(255,255,255,.73)">{f('rank03')}</text><text x="66" y="482" fill="rgba(255,255,255,.9)">{f('cat0088Id')}</text><text x="350" y="482" textAnchor="end" fill="rgba(185,185,185,.76)">{f('score918')}</text></g>
                    <g className="po-resolve d4"><text x="40" y="500" fill="rgba(255,255,255,.7)">{f('rank04')}</text><text x="66" y="500" fill="rgba(255,255,255,.86)">{f('rec1c44')}</text><text x="350" y="500" textAnchor="end" fill="rgba(185,185,185,.72)">{f('score912')}</text></g>
                    <g className="po-resolve d5"><text x="40" y="518" fill="rgba(255,255,255,.67)">{f('rank05')}</text><text x="66" y="518" fill="rgba(255,255,255,.83)">{f('cat1388')}</text><text x="350" y="518" textAnchor="end" fill="rgba(185,185,185,.45)">{f('score909')}</text></g>
                  </g>
                  <rect x="24" y="544" width="220" height="34" fill="none" stroke="rgba(255,255,255,.34)"/>
                  <text x="134" y="560" fontSize="7" letterSpacing=".9" textAnchor="middle" fill="rgba(185,185,185,.86)">{f('openTrackIntelligence')}</text>
                  <text x="134" y="572" fontSize="6.6" letterSpacing=".8" textAnchor="middle" fill="rgba(185,185,185,.72)">{f('oneRecordingSeparate')}</text>
                  <text x="24" y="606" fontSize="6.8" letterSpacing=".8" fill="rgba(185,185,185,.85)">{f('noSharedAuto')}</text>
                  <text x="24" y="618" fontSize="6.8" letterSpacing=".8" fill="rgba(185,185,185,.85)">{f('partnerKeepsControl')}</text>
                </svg>
        </div>
      </div>
    </section>
  );
}
