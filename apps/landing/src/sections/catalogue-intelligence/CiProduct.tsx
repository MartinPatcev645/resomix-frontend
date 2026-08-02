import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CI_DEMO_TRACK, CI_DEMO_TRACK_ID, CI_REF_ID } from './ciData.ts';
import { CiResultList } from './CiResultList.tsx';

/* S2 · The product — two verified outputs (ranked catalogue similarity,
   track-level intelligence). Geometry transplanted verbatim from the
   approved preview (`#s2`). */
export function CiProduct() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const openTrackIntelligence = () => navigate('/product/track-intelligence');

  return (
    <section className="ci-sec ci-section" id="ci-s2">
      <div className="ci-wrap">
        <div className="ci-eyebrow">{t('catalogueIntelligence.product.eyebrow')}</div>
        <h2 className="ci-h2">{t('catalogueIntelligence.product.h2')}</h2>
        <p className="ci-body-p ci-copycol">{t('catalogueIntelligence.product.body')}</p>

        <div className="ci-outputs">
          <div className="ci-module">
            <div className="ci-tt">{t('catalogueIntelligence.product.outATitle')}</div>
            <p>{t('catalogueIntelligence.product.outABody')}</p>
            <div className="ci-mv">
              <div className="ci-refrow">
                <div className="ci-refchip">
                  <div className="ci-refchip-mark">
                    <span className="ci-refchip-line" />
                  </div>
                  {t('catalogueIntelligence.product.refLabel')}
                  <br />
                  {CI_REF_ID}
                </div>
                <div className="ci-rlist-col">
                  <CiResultList />
                </div>
              </div>
            </div>
          </div>

          <div className="ci-module">
            <div className="ci-tt ci-alt">{t('catalogueIntelligence.product.outBTitle')}</div>
            <p>{t('catalogueIntelligence.product.outBBody')}</p>
            <div
              className="ci-mv ci-mv-link"
              role="link"
              tabIndex={0}
              onClick={openTrackIntelligence}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openTrackIntelligence();
                }
              }}
            >
              <svg
                viewBox="0 0 380 168"
                role="img"
                aria-label={t('catalogueIntelligence.product.tiPreviewAria')}
              >
                <text x="6" y="12" fontSize="7.5" letterSpacing="1.2" fill="rgba(255,255,255,.8)">
                  {`${CI_DEMO_TRACK.toUpperCase()} · ${CI_DEMO_TRACK_ID}`}
                </text>
                {/* structure strip */}
                <g fontSize="6" letterSpacing="1" fill="rgba(185,185,185,.55)">
                  <rect x="6" y="22" width="52" height="12" fill="rgba(255,255,255,.08)" />
                  <text x="10" y="31">{t('catalogueIntelligence.figures.intro')}</text>
                  <rect x="60" y="22" width="70" height="12" fill="rgba(255,255,255,.12)" />
                  <text x="64" y="31">{t('catalogueIntelligence.figures.build')}</text>
                  <rect x="132" y="22" width="86" height="12" fill="rgba(238,74,38,.3)" />
                  <text x="136" y="31" fill="rgba(255,255,255,.75)">
                    {t('catalogueIntelligence.figures.drop')}
                  </text>
                  <rect x="220" y="22" width="60" height="12" fill="rgba(255,255,255,.1)" />
                  <text x="224" y="31">{t('catalogueIntelligence.figures.break')}</text>
                  <rect x="282" y="22" width="92" height="12" fill="rgba(255,255,255,.08)" />
                  <text x="286" y="31">{t('catalogueIntelligence.figures.outro')}</text>
                </g>
                {/* energy journey */}
                <text x="6" y="56" fontSize="6.5" letterSpacing="1" fill="rgba(185,185,185,.5)">
                  {t('catalogueIntelligence.figures.energyJourney')}
                </text>
                <path
                  d="M 6 92 C 60 88, 100 82, 132 66 C 160 54, 200 52, 218 62 C 250 78, 300 86, 374 90"
                  fill="none"
                  stroke="rgba(255,255,255,.5)"
                  strokeWidth="1.2"
                />
                <circle cx="175" cy="55" r="2.4" fill="#EE4A26" />
                {/* fields */}
                <g fontSize="6.5" letterSpacing="1">
                  <rect x="6" y="106" width="86" height="22" fill="none" stroke="rgba(255,255,255,.14)" />
                  <text x="12" y="115" fill="rgba(185,185,185,.5)">
                    {t('catalogueIntelligence.figures.tempo')}
                  </text>
                  <text x="12" y="124" fill="rgba(255,255,255,.85)">124 BPM</text>
                  <rect x="98" y="106" width="86" height="22" fill="none" stroke="rgba(255,255,255,.14)" />
                  <text x="104" y="115" fill="rgba(185,185,185,.5)">
                    {t('catalogueIntelligence.figures.harmonic')}
                  </text>
                  <text x="104" y="124" fill="rgba(255,255,255,.85)">F MINOR · 8A</text>
                  <rect x="190" y="106" width="184" height="22" fill="none" stroke="rgba(255,255,255,.14)" />
                  <text x="196" y="115" fill="rgba(185,185,185,.5)">
                    {t('catalogueIntelligence.figures.timbre')}
                  </text>
                  <g fill="rgba(255,255,255,.4)">
                    <rect x="196" y="119" width="30" height="4" />
                    <rect x="230" y="119" width="52" height="4" />
                    <rect x="286" y="119" width="20" height="4" />
                    <rect x="310" y="119" width="40" height="4" />
                  </g>
                </g>
                <text x="6" y="152" fontSize="7" letterSpacing="1.2" fill="rgba(238,74,38,.8)">
                  {t('catalogueIntelligence.product.viewFullTi')}
                </text>
                <text x="374" y="152" fontSize="6" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.4)">
                  {t('catalogueIntelligence.figures.fictionalValues')}
                </text>
              </svg>
            </div>
          </div>
        </div>

        <p className="ci-outputs-note">{t('catalogueIntelligence.product.note')}</p>
      </div>
    </section>
  );
}
