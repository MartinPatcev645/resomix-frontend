import { useTranslation } from 'react-i18next';
import { useCiDefs } from './ciDefs.ts';

/* S7 · Catalogue boundary — two fully separate partner indexes, no shared
   pool. Geometry transplanted verbatim from the approved preview; fictional
   per-partner IDs are hardcoded exactly as in the source. */
export function CiBoundary() {
  const { t } = useTranslation('common');
  const { url } = useCiDefs();

  return (
    <section className="ci-sec ci-section" id="ci-s7">
      <div className="ci-wrap">
        <div className="ci-eyebrow">{t('catalogueIntelligence.boundary.eyebrow')}</div>
        <h2 className="ci-h2">{t('catalogueIntelligence.boundary.h2')}</h2>
        <div className="ci-copycol">
          <p className="ci-body-p">{t('catalogueIntelligence.boundary.body1')}</p>
          <p className="ci-body-p">{t('catalogueIntelligence.boundary.body2')}</p>
        </div>
      </div>

      <div className="ci-wrap ci-bleed ci-fig">
        <div className="ci-stagebox">
          <div className="ci-grain" aria-hidden="true" />

          {/* ================= ISOLATION · DESKTOP ================= */}
          <svg
            className="ci-d-only"
            viewBox="0 0 1200 300"
            role="img"
            aria-label={t('catalogueIntelligence.boundary.figureAriaD')}
          >
            <g>
              <circle
                cx="600"
                cy="56"
                r="24"
                fill="none"
                stroke="rgba(255,255,255,.3)"
                strokeDasharray="94 56"
                transform="rotate(150 600 56)"
              />
              <rect x="595" y="51" width="10" height="10" fill="#0C0C0D" stroke="rgba(238,74,38,.85)" transform="rotate(45 600 56)" />
              <text x="600" y="24" fontSize="9" letterSpacing="2.5" textAnchor="middle" fill="rgba(255,255,255,.9)">
                {t('catalogueIntelligence.figures.pyxis')}
              </text>
              <text x="600" y="104" fontSize="7" letterSpacing="1.2" textAnchor="middle" fill="rgba(185,185,185,.5)">
                {t('catalogueIntelligence.figures.oneCapability')}
              </text>
            </g>
            <path d="M 576 70 C 500 96, 420 108, 340 116" fill="none" stroke="rgba(255,255,255,.25)" />
            <path d="M 624 70 C 700 96, 780 108, 860 116" fill="none" stroke="rgba(255,255,255,.25)" />

            {/* partner A */}
            <g>
              <rect x="90" y="122" width="420" height="130" fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="2 6" />
              <g stroke="rgba(255,255,255,.38)" fill="none">
                <path d="M 90 136 V 122 H 104" />
                <path d="M 496 122 H 510 V 136" />
                <path d="M 90 238 V 252 H 104" />
                <path d="M 496 252 H 510 V 238" />
              </g>
              <rect x="104" y="136" width="250" height="102" fill={url('cells')} />
              <rect x="104" y="136" width="250" height="102" fill={url('cellsMark')} />
              <text x="90" y="272" fontSize="9.5" letterSpacing="1.6" fill="rgba(255,255,255,.95)">
                {t('catalogueIntelligence.figures.partnerAIndex')}
              </text>
              <rect x="368" y="140" width="18" height="11" fill="none" stroke="rgba(238,74,38,.7)" />
              <circle cx="373" cy="145" r="1.8" fill="rgba(238,74,38,.8)" />
              <text x="392" y="149" fontSize="7.8" letterSpacing="1" fill="rgba(185,185,185,.7)">
                {t('catalogueIntelligence.figures.keyA')}
              </text>
              <text x="368" y="172" fontSize="7.8" letterSpacing="1" fill="rgba(185,185,185,.62)">
                {t('catalogueIntelligence.figures.queryA')}
              </text>
              <g fontSize="7" letterSpacing="1">
                <text x="368" y="196" fill="rgba(255,255,255,.7)">01 CAT-A-0417</text>
                <text x="368" y="210" fill="rgba(255,255,255,.55)">02 CAT-A-1121</text>
                <text x="368" y="224" fill="rgba(255,255,255,.45)">03 CAT-A-0088</text>
              </g>
            </g>

            {/* partner B */}
            <g>
              <rect x="690" y="122" width="420" height="130" fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="2 6" />
              <g stroke="rgba(255,255,255,.38)" fill="none">
                <path d="M 690 136 V 122 H 704" />
                <path d="M 1096 122 H 1110 V 136" />
                <path d="M 690 238 V 252 H 704" />
                <path d="M 1096 252 H 1110 V 238" />
              </g>
              <rect x="704" y="136" width="250" height="102" fill={url('cells')} />
              <rect x="704" y="136" width="250" height="102" fill={url('cellsMark')} />
              <text x="690" y="272" fontSize="9.5" letterSpacing="1.6" fill="rgba(255,255,255,.95)">
                {t('catalogueIntelligence.figures.partnerBIndex')}
              </text>
              <rect x="968" y="140" width="18" height="11" fill="none" stroke="rgba(238,74,38,.7)" />
              <circle cx="973" cy="145" r="1.8" fill="rgba(238,74,38,.8)" />
              <text x="992" y="149" fontSize="7.8" letterSpacing="1" fill="rgba(185,185,185,.7)">
                {t('catalogueIntelligence.figures.keyB')}
              </text>
              <text x="968" y="172" fontSize="7.8" letterSpacing="1" fill="rgba(185,185,185,.62)">
                {t('catalogueIntelligence.figures.queryB')}
              </text>
              <g fontSize="7" letterSpacing="1">
                <text x="968" y="196" fill="rgba(255,255,255,.7)">01 CAT-B-2290</text>
                <text x="968" y="210" fill="rgba(255,255,255,.55)">02 CAT-B-0311</text>
                <text x="968" y="224" fill="rgba(255,255,255,.45)">03 CAT-B-1902</text>
              </g>
            </g>

            <text x="600" y="292" fontSize="9.5" letterSpacing="2" textAnchor="middle" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.noSharedPool')}
            </text>
          </svg>

          {/* ================= ISOLATION · MOBILE ================= */}
          <svg
            className="ci-m-only"
            viewBox="0 0 390 420"
            role="img"
            aria-label={t('catalogueIntelligence.boundary.figureAriaM')}
          >
            <circle
              cx="195"
              cy="36"
              r="20"
              fill="none"
              stroke="rgba(255,255,255,.3)"
              strokeDasharray="78 48"
              transform="rotate(150 195 36)"
            />
            <rect x="190" y="31" width="10" height="10" fill="#0C0C0D" stroke="rgba(238,74,38,.85)" transform="rotate(45 195 36)" />
            <text x="232" y="40" fontSize="14" letterSpacing="2" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.pyxis')}
            </text>
            <path d="M 178 48 C 140 66, 110 76, 92 84" fill="none" stroke="rgba(255,255,255,.25)" />
            <path d="M 212 48 C 250 66, 280 76, 298 84" fill="none" stroke="rgba(255,255,255,.25)" />

            <rect x="24" y="92" width="342" height="120" fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="2 6" />
            <rect x="36" y="104" width="180" height="96" fill={url('cells')} />
            <rect x="36" y="104" width="180" height="96" fill={url('cellsMark')} />
            <text x="24" y="230" fontSize="14" letterSpacing="1.4" fill="rgba(255,255,255,.95)">
              {t('catalogueIntelligence.figures.partnerAIndex')}
            </text>
            <rect x="230" y="108" width="16" height="10" fill="none" stroke="rgba(238,74,38,.7)" />
            <text x="252" y="116" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.6)">
              {t('catalogueIntelligence.figures.keyA')}
            </text>
            <g fontSize="6.8" letterSpacing="1">
              <text x="230" y="140" fill="rgba(255,255,255,.7)">01 CAT-A-0417</text>
              <text x="230" y="154" fill="rgba(255,255,255,.55)">02 CAT-A-1121</text>
              <text x="230" y="168" fill="rgba(255,255,255,.45)">03 CAT-A-0088</text>
            </g>

            <rect x="24" y="252" width="342" height="120" fill="none" stroke="rgba(255,255,255,.2)" strokeDasharray="2 6" />
            <rect x="36" y="264" width="180" height="96" fill={url('cells')} />
            <rect x="36" y="264" width="180" height="96" fill={url('cellsMark')} />
            <text x="24" y="390" fontSize="14" letterSpacing="1.4" fill="rgba(255,255,255,.95)">
              {t('catalogueIntelligence.figures.partnerBIndex')}
            </text>
            <rect x="230" y="268" width="16" height="10" fill="none" stroke="rgba(238,74,38,.7)" />
            <text x="252" y="276" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.6)">
              {t('catalogueIntelligence.figures.keyB')}
            </text>
            <g fontSize="6.8" letterSpacing="1">
              <text x="230" y="300" fill="rgba(255,255,255,.7)">01 CAT-B-2290</text>
              <text x="230" y="314" fill="rgba(255,255,255,.55)">02 CAT-B-0311</text>
              <text x="230" y="328" fill="rgba(255,255,255,.45)">03 CAT-B-1902</text>
            </g>
            <text x="195" y="414" fontSize="14" letterSpacing="1.6" textAnchor="middle" fill="rgba(255,255,255,.9)">
              {t('catalogueIntelligence.figures.noSharedPool')}
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
