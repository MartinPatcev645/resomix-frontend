import { useTranslation } from 'react-i18next';
import { useCiDefs } from './ciDefs.ts';
import { CiResultList } from './CiResultList.tsx';

/* S3 · From reference to result — the two input routes converge into one
   reference profile, compared with the partner index, resolving into the
   real ranked-result list. Geometry transplanted verbatim from the approved
   preview (`#s3`). */
export function CiFlow() {
  const { t } = useTranslation('common');
  const { url } = useCiDefs();

  return (
    <section className="ci-sec ci-section" id="ci-s3">
      <div className="ci-wrap">
        <div className="ci-eyebrow">{t('catalogueIntelligence.flow.eyebrow')}</div>
        <h2 className="ci-h2">{t('catalogueIntelligence.flow.h2')}</h2>
        <div className="ci-copycol">
          <p className="ci-body-p">{t('catalogueIntelligence.flow.body1')}</p>
          <p className="ci-body-p">{t('catalogueIntelligence.flow.body2')}</p>
        </div>
      </div>

      <div className="ci-wrap ci-bleed ci-fig">
        <div className="ci-stagebox">
          <div className="ci-grain" aria-hidden="true" />
          <div className="ci-flowgrid">
            {/* ============ FLOW · DESKTOP ============ */}
            <svg
              className="ci-d-only"
              viewBox="0 0 820 320"
              role="img"
              aria-label={t('catalogueIntelligence.flow.figureAriaD')}
            >
              <path d="M 24 44 h 168 l 10 10 v 44 h -178 z" fill="#151516" stroke="rgba(255,255,255,.14)" />
              <text x="36" y="72" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.88)">
                {t('catalogueIntelligence.figures.indexedCatalogueTrack')}
              </text>
              <text x="24" y="116" fontSize="8.5" letterSpacing="1" fill="rgba(185,185,185,.68)">
                {t('catalogueIntelligence.figures.existingProfileUsed')}
              </text>

              <path d="M 24 148 h 168 l 10 10 v 44 h -178 z" fill="#151516" stroke="rgba(255,255,255,.14)" />
              <text x="36" y="176" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.88)">
                {t('catalogueIntelligence.figures.authorisedUpload')}
              </text>
              <text x="24" y="220" fontSize="8.5" letterSpacing="1" fill="rgba(185,185,185,.68)">
                {t('catalogueIntelligence.figures.profileCreatedBefore')}
              </text>

              <path d="M 202 72 C 250 78, 272 104, 288 120" fill="none" stroke="rgba(238,74,38,.7)" />
              <path
                d="M 202 176 C 250 170, 272 144, 288 128"
                fill="none"
                stroke="rgba(238,74,38,.7)"
                strokeDasharray="3 4"
              />
              <circle cx="258" cy="150" r="3.5" fill="none" stroke="rgba(238,74,38,.6)" />

              <circle cx="306" cy="124" r="22" fill={url('halo')} />
              <circle cx="306" cy="124" r="9" fill="none" stroke="rgba(238,74,38,.5)" />
              <circle cx="306" cy="124" r="3.8" fill="#EE4A26" />
              <text x="306" y="88" fontSize="9.5" letterSpacing="1.8" textAnchor="middle" fill="rgba(255,255,255,.95)">
                {t('catalogueIntelligence.figures.oneReferenceProfile')}
              </text>

              <path className="ci-sig" d="M 318 124 H 392" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

              <g>
                <circle
                  cx="432"
                  cy="124"
                  r="16"
                  fill="none"
                  stroke="rgba(255,255,255,.35)"
                  strokeDasharray="64 37"
                  transform="rotate(30 432 124)"
                />
                <rect
                  x="427"
                  y="119"
                  width="10"
                  height="10"
                  fill="#0C0C0D"
                  stroke="rgba(238,74,38,.85)"
                  transform="rotate(45 432 124)"
                />
              </g>
              <text x="432" y="164" fontSize="9" letterSpacing="1.4" textAnchor="middle" fill="rgba(255,255,255,.88)">
                {t('catalogueIntelligence.figures.compareWith')}
              </text>
              <text x="432" y="180" fontSize="9" letterSpacing="1.4" textAnchor="middle" fill="rgba(255,255,255,.88)">
                {t('catalogueIntelligence.figures.partnerIndex')}
              </text>

              <path className="ci-sig" d="M 450 124 H 512" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

              <rect x="524" y="52" width="220" height="150" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 6" />
              <g stroke="rgba(255,255,255,.34)" fill="none">
                <path d="M 524 64 V 52 H 536" />
                <path d="M 732 52 H 744 V 64" />
                <path d="M 524 190 V 202 H 536" />
                <path d="M 732 202 H 744 V 190" />
              </g>
              <rect x="536" y="64" width="196" height="126" fill={url('cells')} />
              <rect x="536" y="64" width="196" height="126" fill={url('cellsMark')} />
              <text x="524" y="222" fontSize="9" letterSpacing="1.4" fill="rgba(255,255,255,.9)">
                {t('catalogueIntelligence.figures.partnerIndex')}
              </text>
              <text x="524" y="238" fontSize="8" letterSpacing="1" fill="rgba(185,185,185,.62)">
                {t('catalogueIntelligence.figures.candidatesNotReanalysed')}
              </text>

              <path
                className="ci-sig"
                d="M 632 124 C 700 124, 750 124, 812 124"
                fill="none"
                stroke="#EE4A26"
                strokeWidth="1.6"
              />
              <text x="422" y="292" fontSize="9" letterSpacing="1.8" textAnchor="middle" fill="rgba(255,255,255,.85)">
                {t('catalogueIntelligence.figures.oneReferenceIn')}
              </text>
            </svg>

            {/* ============ FLOW · MOBILE ============ */}
            <svg
              className="ci-m-only"
              viewBox="0 0 390 560"
              role="img"
              aria-label={t('catalogueIntelligence.flow.figureAriaM')}
            >
              <path d="M 20 20 h 342 l 8 8 v 38 h -350 z" fill="#151516" stroke="rgba(255,255,255,.14)" />
              <text x="32" y="46" fontSize="14" letterSpacing="1.2" fill="rgba(255,255,255,.88)">
                {t('catalogueIntelligence.figures.indexedCatalogueTrack')}
              </text>
              <text x="358" y="46" fontSize="14" letterSpacing=".8" textAnchor="end" fill="rgba(185,185,185,.68)">
                {t('catalogueIntelligence.figures.existingProfileUsed')}
              </text>
              <text x="195" y="86" fontSize="7" letterSpacing="2" textAnchor="middle" fill="rgba(185,185,185,.4)">
                {t('catalogueIntelligence.figures.or')}
              </text>
              <path d="M 20 98 h 342 l 8 8 v 38 h -350 z" fill="#151516" stroke="rgba(255,255,255,.14)" />
              <text x="32" y="120" fontSize="14" letterSpacing="1.2" fill="rgba(255,255,255,.88)">
                {t('catalogueIntelligence.figures.authorisedUpload')}
              </text>
              <text x="358" y="134" fontSize="14" letterSpacing=".8" textAnchor="end" fill="rgba(185,185,185,.68)">
                {t('catalogueIntelligence.figures.profileCreatedBefore')}
              </text>

              <path className="ci-sig" d="M 195 146 V 182" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
              <circle cx="195" cy="204" r="18" fill={url('halo')} />
              <circle cx="195" cy="204" r="3.6" fill="#EE4A26" />
              <text x="195" y="240" fontSize="14" letterSpacing="1.5" textAnchor="middle" fill="rgba(255,255,255,.95)">
                {t('catalogueIntelligence.figures.oneReferenceProfile')}
              </text>

              <path className="ci-sig" d="M 195 250 V 284" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
              <circle
                cx="195"
                cy="306"
                r="14"
                fill="none"
                stroke="rgba(255,255,255,.35)"
                strokeDasharray="56 32"
                transform="rotate(30 195 306)"
              />
              <rect
                x="190"
                y="301"
                width="10"
                height="10"
                fill="#0C0C0D"
                stroke="rgba(238,74,38,.85)"
                transform="rotate(45 195 306)"
              />
              <text x="195" y="342" fontSize="14" letterSpacing="1.4" textAnchor="middle" fill="rgba(255,255,255,.88)">
                {t('catalogueIntelligence.figures.compareWithPartnerIndex')}
              </text>

              <path className="ci-sig" d="M 195 352 V 380" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
              <rect x="70" y="386" width="250" height="120" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 6" />
              <rect x="82" y="398" width="226" height="96" fill={url('cells')} />
              <rect x="82" y="398" width="226" height="96" fill={url('cellsMark')} />
              <text x="70" y="526" fontSize="14" letterSpacing="1" fill="rgba(255,255,255,.9)">
                {t('catalogueIntelligence.figures.partnerIndexCandidates')}
              </text>
              <path className="ci-sig" d="M 195 506 V 546" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
              <text x="195" y="558" fontSize="14" letterSpacing="1.2" textAnchor="middle" fill="rgba(255,255,255,.85)">
                {t('catalogueIntelligence.figures.oneReferenceIn')}
              </text>
            </svg>

            {/* ranked result list (real interface the lattice resolves into) */}
            <aside className="ci-flowlist">
              <div className="ci-flowlist-label">
                <span className="ci-arrow">→</span> {t('catalogueIntelligence.flow.rankedLabel')}
              </div>
              <CiResultList variant="flow" />
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
