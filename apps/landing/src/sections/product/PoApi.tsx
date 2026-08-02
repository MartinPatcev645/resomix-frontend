import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePoDefs } from './poDefs.ts';

/* S7 · Scoped API route. */
export function PoApi() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = usePoDefs();
  const f = (key: string) => t(`product.figures.${key}`);

  return (
    <section className="po-sec po-section" id="po-s7">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.api.eyebrow')}</div>
        <h2 className="po-h2">{t('product.api.h2')}</h2>
        <div className="po-copycol">
          <p className="po-body-p">{t('product.api.body1')}</p>
          <p className="po-body-p">{t('product.api.body2')}</p>
        </div>
        <div className="po-cta-row">
          <button type="button" className="po-btn po-primary" onClick={() => navigate('/partners/pilot')}>
            {t('product.api.ctaPrimary')}
          </button>
          <button type="button" className="po-btn" onClick={() => navigate('/developers')}>
            {t('product.api.ctaSecondary')}
          </button>
        </div>
        <div className="po-status-rail">{t('product.api.status')}</div>
      </div>

      <div className="po-wrap po-bleed po-fig">
        <div className="po-stagebox">
          <div className="po-grain" aria-hidden="true" />

                {/* ============ API ROUTE · DESKTOP ============ */}
                <svg className="po-d-only" viewBox="0 0 1200 260" role="img"
                     aria-label={t('product.api.figureAriaD')}>
                  <path d="M 60 96 h 176 l 12 12 v 56 h -188 z" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
                  <text x="76" y="126" fontSize="8.5" letterSpacing="1.2" fill="rgba(255,255,255,.96)">{f('partnerProduct')}</text>
                  <path className="po-sig" d="M 248 130 H 314" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                  <g>
                    <rect x="326" y="106" width="132" height="48" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
                    <rect x="340" y="122" width="18" height="11" fill="none" stroke="rgba(238,74,38,.7)"/>
                    <circle cx="345" cy="127" r="1.8" fill="rgba(238,74,38,.8)"/>
                    <text x="366" y="126" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.96)">{f('scoped')}</text>
                    <text x="366" y="140" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.96)">{f('apiKey')}</text>
                  </g>
                  <path className="po-sig" d="M 458 130 H 524" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>

                  {/* resomix service boundary */}
                  <g>
                    <rect x="536" y="40" width="330" height="186" fill="none" stroke="rgba(255,255,255,.48)" strokeWidth="1.6"/>
                    <text x="536" y="28" fontSize="9" letterSpacing="1.6" fill="rgba(255,255,255,.95)">{f('resomixServiceBoundary')}</text>
                    <rect x="556" y="62" width="132" height="40" fill="#1E1E21" stroke="rgba(238,74,38,.5)"/>
                    <text x="622" y="86" fontSize="8" letterSpacing="1.2" textAnchor="middle" fill="rgba(255,255,255,.96)">{f('similarity')}</text>
                    <rect x="556" y="112" width="132" height="40" fill="#1E1E21" stroke="rgba(255,255,255,.3)"/>
                    <text x="622" y="136" fontSize="8" letterSpacing="1.2" textAnchor="middle" fill="rgba(255,255,255,.96)">{f('trackAnalysis')}</text>
                    <rect x="706" y="62" width="140" height="120" fill="none" stroke="rgba(255,255,255,.34)" strokeDasharray="2 6"/>
                    <rect x="716" y="72" width="120" height="86" fill={url('cells')}/>
                    <text x="706" y="200" fontSize="7.5" letterSpacing="1" fill="rgba(185,185,185,.85)">{f('samePartnerScope')}</text>
                    <text x="556" y="200" fontSize="7.5" letterSpacing="1" fill="rgba(185,185,185,.82)">{f('partnerSonicIndexInside')}</text>
                  </g>

                  <path className="po-sig" d="M 866 110 C 910 108, 940 106, 984 104" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                  <rect x="996" y="80" width="150" height="46" fill="#1C1C1F" stroke="rgba(255,255,255,.3)"/>
                  <text x="1012" y="100" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.96)">{f('similarityOr')}</text>
                  <text x="1012" y="114" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.96)">{f('analysisResponse')}</text>
                  <path d="M 1071 126 V 158" fill="none" stroke="rgba(255,255,255,.46)"/>
                  <rect x="996" y="164" width="150" height="46" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
                  <text x="1012" y="184" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.96)">{f('partner')}</text>
                  <text x="1012" y="198" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.96)">{f('interface')}</text>
                  <text x="600" y="248" fontSize="7.5" letterSpacing="1.2" fill="rgba(185,185,185,.8)">{f('apiFoot')}</text>
                </svg>

                {/* ============ API ROUTE · MOBILE ============ */}
                <svg className="po-m-only" viewBox="0 0 390 500" role="img"
                     aria-label={t('product.api.figureAriaM')}>
                  <path d="M 60 16 h 258 l 10 10 v 38 h -268 z" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
                  <text x="195" y="46" fontSize="8.5" letterSpacing="1.2" textAnchor="middle" fill="rgba(255,255,255,.96)">{f('partnerProduct')}</text>
                  <path className="po-sig" d="M 195 66 V 92" fill="none" stroke="#EE4A26" strokeWidth="1.4"/>
                  <rect x="110" y="98" width="170" height="44" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
                  <rect x="124" y="114" width="16" height="10" fill="none" stroke="rgba(238,74,38,.7)"/>
                  <circle cx="129" cy="119" r="1.6" fill="rgba(238,74,38,.8)"/>
                  <text x="150" y="124" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.96)">{f('scopedApiKey')}</text>
                  <path className="po-sig" d="M 195 142 V 168" fill="none" stroke="#EE4A26" strokeWidth="1.4"/>
                  <rect x="24" y="174" width="342" height="188" fill="none" stroke="rgba(255,255,255,.48)" strokeWidth="1.6"/>
                  <text x="24" y="164" fontSize="8.5" letterSpacing="1.3" fill="rgba(255,255,255,.95)">{f('resomixServiceBoundary')}</text>
                  <rect x="40" y="190" width="150" height="38" fill="#1E1E21" stroke="rgba(238,74,38,.5)"/>
                  <text x="115" y="213" fontSize="7.8" letterSpacing="1.1" textAnchor="middle" fill="rgba(255,255,255,.96)">{f('similarity')}</text>
                  <rect x="40" y="238" width="150" height="38" fill="#1E1E21" stroke="rgba(255,255,255,.3)"/>
                  <text x="115" y="261" fontSize="7.8" letterSpacing="1.1" textAnchor="middle" fill="rgba(255,255,255,.96)">{f('trackAnalysis')}</text>
                  <rect x="206" y="190" width="144" height="110" fill="none" stroke="rgba(255,255,255,.34)" strokeDasharray="2 6"/>
                  <rect x="216" y="200" width="124" height="78" fill={url('cells')}/>
                  <text x="206" y="316" fontSize="7" letterSpacing=".9" fill="rgba(185,185,185,.85)">{f('samePartnerScope')}</text>
                  <text x="40" y="300" fontSize="7" letterSpacing=".9" fill="rgba(185,185,185,.82)">{f('partnerSonicIndexInside')}</text>
                  <path className="po-sig" d="M 195 362 V 388" fill="none" stroke="#EE4A26" strokeWidth="1.4"/>
                  <rect x="70" y="394" width="250" height="40" fill="#1C1C1F" stroke="rgba(255,255,255,.3)"/>
                  <text x="195" y="418" fontSize="7.8" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.96)">{f('similarityOrAnalysis')}</text>
                  <path d="M 195 434 V 452" fill="none" stroke="rgba(255,255,255,.46)"/>
                  <rect x="110" y="458" width="170" height="36" fill="#17171A" stroke="rgba(255,255,255,.3)"/>
                  <text x="195" y="480" fontSize="7.8" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.96)">{f('partnerInterface')}</text>
                </svg>
        </div>
      </div>
    </section>
  );
}
