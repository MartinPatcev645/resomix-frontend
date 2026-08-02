import { useTranslation } from 'react-i18next';
import { useCiDefs } from './ciDefs.ts';

/* S6 · Partner experience — the four-part integration architecture.
   Geometry transplanted verbatim from the approved preview. */
export function CiPartner() {
  const { t } = useTranslation('common');
  const { url } = useCiDefs();

  return (
    <section className="ci-sec ci-section" id="ci-s6">
      <div className="ci-wrap">
        <div className="ci-eyebrow">{t('catalogueIntelligence.partner.eyebrow')}</div>
        <h2 className="ci-h2">{t('catalogueIntelligence.partner.h2')}</h2>
        <div className="ci-copycol">
          <p className="ci-body-p">{t('catalogueIntelligence.partner.body1')}</p>
          <p className="ci-body-p">{t('catalogueIntelligence.partner.body2')}</p>
        </div>
      </div>

      <div className="ci-wrap ci-bleed ci-fig">
        <div className="ci-stagebox">
          <div className="ci-grain" aria-hidden="true" />

          {/* ================= INTEGRATION · DESKTOP ================= */}
          <svg
            className="ci-d-only"
            viewBox="0 0 1200 260"
            role="img"
            aria-label={t('catalogueIntelligence.partner.figureAriaD')}
          >
            <path d="M 70 92 h 210 l 12 12 v 64 h -222 z" fill="#151516" stroke="rgba(255,255,255,.16)" />
            <text x="88" y="126" fontSize="9" letterSpacing="1.6" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.partnerProduct')}
            </text>
            <text x="88" y="142" fontSize="9" letterSpacing="1.6" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.orInternalTool')}
            </text>

            <path className="ci-sig" d="M 292 130 H 372" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            <g>
              <rect x="384" y="102" width="150" height="56" fill="#151516" stroke="rgba(255,255,255,.16)" />
              <rect x="398" y="120" width="20" height="12" fill="none" stroke="rgba(238,74,38,.7)" />
              <circle cx="404" cy="126" r="2" fill="rgba(238,74,38,.8)" />
              <text x="428" y="124" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.9)">
                {t('catalogueIntelligence.figures.scoped')}
              </text>
              <text x="428" y="138" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.9)">
                {t('catalogueIntelligence.figures.apiAccess')}
              </text>
              <text x="384" y="176" fontSize="7.8" letterSpacing="1" fill="rgba(185,185,185,.62)">
                {t('catalogueIntelligence.figures.bearerKeyed')}
              </text>
            </g>

            <path className="ci-sig" d="M 534 130 H 614" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            <g>
              <rect x="626" y="72" width="220" height="116" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 6" />
              <g stroke="rgba(255,255,255,.34)" fill="none">
                <path d="M 626 84 V 72 H 638" />
                <path d="M 834 72 H 846 V 84" />
                <path d="M 626 176 V 188 H 638" />
                <path d="M 834 188 H 846 V 176" />
              </g>
              <rect x="638" y="84" width="196" height="92" fill={url('cells')} />
              <rect x="638" y="84" width="196" height="92" fill={url('cellsMark')} />
              <text x="626" y="208" fontSize="8.5" letterSpacing="1.5" fill="rgba(255,255,255,.9)">
                {t('catalogueIntelligence.figures.partnerSonicIndex')}
              </text>
            </g>

            <path className="ci-sig" d="M 846 110 C 900 104, 930 98, 972 92" fill="none" stroke="#EE4A26" strokeWidth="1.4" />
            <path d="M 846 150 C 900 156, 930 162, 972 168" fill="none" stroke="rgba(255,255,255,.3)" />

            <rect x="984" y="70" width="180" height="42" fill="#151516" stroke="rgba(238,74,38,.5)" />
            <text x="1000" y="88" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.rankedSimilarity')}
            </text>
            <text x="1000" y="102" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.results')}
            </text>
            <rect x="984" y="148" width="180" height="42" fill="#151516" stroke="rgba(255,255,255,.16)" />
            <text x="1000" y="166" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.trackAnalysis')}
            </text>
            <text x="1000" y="180" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.response')}
            </text>

            <text x="600" y="242" fontSize="7.5" letterSpacing="1.4" textAnchor="middle" fill="rgba(185,185,185,.6)">
              {t('catalogueIntelligence.figures.partnerOwns')}
            </text>
          </svg>

          {/* ================= INTEGRATION · MOBILE ================= */}
          <svg
            className="ci-m-only"
            viewBox="0 0 390 470"
            role="img"
            aria-label={t('catalogueIntelligence.partner.figureAriaM')}
          >
            <path d="M 60 20 h 258 l 10 10 v 40 h -268 z" fill="#151516" stroke="rgba(255,255,255,.16)" />
            <text x="195" y="50" fontSize="8.5" letterSpacing="1.4" textAnchor="middle" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.partnerProductOrTool')}
            </text>
            <path className="ci-sig" d="M 195 70 V 100" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <rect x="100" y="106" width="190" height="48" fill="#151516" stroke="rgba(255,255,255,.16)" />
            <rect x="114" y="122" width="18" height="11" fill="none" stroke="rgba(238,74,38,.7)" />
            <circle cx="119" cy="127" r="1.8" fill="rgba(238,74,38,.8)" />
            <text x="142" y="132" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.scopedApiAccess')}
            </text>
            <text x="195" y="170" fontSize="6.6" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.5)">
              {t('catalogueIntelligence.figures.bearerKeyed')}
            </text>
            <path className="ci-sig" d="M 195 178 V 208" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <rect x="70" y="214" width="250" height="110" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 6" />
            <rect x="82" y="226" width="226" height="86" fill={url('cells')} />
            <rect x="82" y="226" width="226" height="86" fill={url('cellsMark')} />
            <text x="195" y="344" fontSize="8" letterSpacing="1.4" textAnchor="middle" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.partnerSonicIndex')}
            </text>
            <path className="ci-sig" d="M 130 352 C 120 372, 112 380, 106 388" fill="none" stroke="#EE4A26" strokeWidth="1.3" />
            <path d="M 260 352 C 270 372, 278 380, 284 388" fill="none" stroke="rgba(255,255,255,.3)" />
            <rect x="24" y="394" width="166" height="40" fill="#151516" stroke="rgba(238,74,38,.5)" />
            <text x="107" y="412" fontSize="7" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.rankedSimilarity')}
            </text>
            <text x="107" y="424" fontSize="7" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.results')}
            </text>
            <rect x="200" y="394" width="166" height="40" fill="#151516" stroke="rgba(255,255,255,.16)" />
            <text x="283" y="412" fontSize="7" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.trackAnalysis')}
            </text>
            <text x="283" y="424" fontSize="7" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.response')}
            </text>
            <text x="195" y="460" fontSize="6.4" letterSpacing=".8" textAnchor="middle" fill="rgba(185,185,185,.6)">
              {t('catalogueIntelligence.figures.partnerOwns')}
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
