import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/* S9 · Trust & control — two never-merging lanes. */
export function PoTrust() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const f = (key: string) => t(`product.figures.${key}`);

  return (
    <section className="po-sec po-section" id="po-s9">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.trust.eyebrow')}</div>
        <h2 className="po-h2">{t('product.trust.h2')}</h2>
        <p className="po-body-p po-copycol">{t('product.trust.body')}</p>

        <div className="po-controls">
          <div className="po-ctrl">
            <h3>{t('product.trust.c1Title')}</h3>
            <p>{t('product.trust.c1Body')}</p>
          </div>
          <div className="po-ctrl">
            <h3>{t('product.trust.c2Title')}</h3>
            <p>{t('product.trust.c2Body')}</p>
          </div>
          <div className="po-ctrl">
            <h3>{t('product.trust.c3Title')}</h3>
            <p>{t('product.trust.c3Body')}</p>
          </div>
          <div className="po-ctrl">
            <h3>{t('product.trust.c4Title')}</h3>
            <p>{t('product.trust.c4Body')}</p>
          </div>
        </div>
        <div className="po-cta-row">
          <button type="button" className="po-btn" onClick={() => navigate('/trust')}>
            {t('product.trust.cta')}
          </button>
        </div>
      </div>

      <div className="po-wrap po-bleed po-fig">
        <div className="po-stagebox">
          <div className="po-grain" aria-hidden="true" />

          <svg
            className="po-d-only"
            viewBox="0 0 1200 240"
            role="img"
            aria-label={t('product.trust.figureAriaD')}
          >
            <text x="60" y="40" fontSize="9" letterSpacing="1.8" fill="rgba(255,255,255,.96)">
              {f('userLane')}
            </text>
            <g fontSize="8" letterSpacing="1">
              <rect x="60" y="56" width="200" height="40" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="76" y="80" fill="rgba(255,255,255,.95)">
                {f('privateReference')}
              </text>
              <rect x="320" y="56" width="200" height="40" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="336" y="80" fill="rgba(255,255,255,.95)">
                {f('pyxisProcessing')}
              </text>
              <rect x="580" y="56" width="200" height="40" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="596" y="80" fill="rgba(255,255,255,.95)">
                {f('requestComplete')}
              </text>
              <rect x="840" y="56" width="220" height="40" fill="#17171A" stroke="rgba(255,255,255,.34)" />
              <text x="856" y="80" fill="rgba(255,255,255,.97)">
                {f('deletionWithin24h')}
              </text>
            </g>
            <g stroke="rgba(238,74,38,.6)">
              <line x1="260" y1="76" x2="320" y2="76" />
              <line x1="520" y1="76" x2="580" y2="76" />
              <line x1="780" y1="76" x2="840" y2="76" />
            </g>

            <line x1="60" y1="128" x2="1140" y2="128" stroke="rgba(255,255,255,.08)" strokeDasharray="2 8" />
            <text x="1140" y="120" fontSize="7" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.45)">
              {f('lanesNeverMerge')}
            </text>

            <text x="60" y="160" fontSize="9" letterSpacing="1.8" fill="rgba(255,255,255,.96)">
              {f('partnerLane')}
            </text>
            <g fontSize="8" letterSpacing="1">
              <rect x="60" y="176" width="200" height="40" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="76" y="200" fill="rgba(255,255,255,.95)">
                {f('authorisedCatalogue')}
              </text>
              <rect x="320" y="176" width="230" height="40" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="336" y="200" fill="rgba(255,255,255,.95)">
                {f('partnerScopedProcessing')}
              </text>
              <rect x="610" y="176" width="180" height="40" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.8" />
              <text x="626" y="200" fill="rgba(255,255,255,.97)">
                {f('privateIndex')}
              </text>
              <rect x="850" y="176" width="240" height="40" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="866" y="200" fill="rgba(255,255,255,.95)">
                {f('authorisedPartnerOutput')}
              </text>
            </g>
            <g stroke="rgba(255,255,255,.5)">
              <line x1="260" y1="196" x2="320" y2="196" />
              <line x1="550" y1="196" x2="610" y2="196" />
              <line x1="790" y1="196" x2="850" y2="196" />
            </g>
          </svg>

          <svg
            className="po-m-only"
            viewBox="0 0 390 430"
            role="img"
            aria-label={t('product.trust.figureAriaM')}
          >
            <text x="24" y="24" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.96)">
              {f('userLane')}
            </text>
            <g fontSize="7.6" letterSpacing=".9">
              <rect x="24" y="34" width="342" height="30" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="38" y="53" fill="rgba(255,255,255,.95)">
                {f('privateReference')}
              </text>
              <rect x="24" y="72" width="342" height="30" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="38" y="91" fill="rgba(255,255,255,.95)">
                {f('pyxisProcessing')}
              </text>
              <rect x="24" y="110" width="342" height="30" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="38" y="129" fill="rgba(255,255,255,.95)">
                {f('requestComplete')}
              </text>
              <rect x="24" y="148" width="342" height="30" fill="#17171A" stroke="rgba(255,255,255,.34)" />
              <text x="38" y="167" fill="rgba(255,255,255,.97)">
                {f('deletionWithin24h')}
              </text>
            </g>
            <line x1="24" y1="204" x2="366" y2="204" stroke="rgba(255,255,255,.08)" strokeDasharray="2 8" />
            <text x="366" y="196" fontSize="6.6" letterSpacing=".8" textAnchor="end" fill="rgba(185,185,185,.45)">
              {f('lanesNeverMerge')}
            </text>
            <text x="24" y="232" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.96)">
              {f('partnerLane')}
            </text>
            <g fontSize="7.6" letterSpacing=".9">
              <rect x="24" y="242" width="342" height="30" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="38" y="261" fill="rgba(255,255,255,.95)">
                {f('authorisedCatalogue')}
              </text>
              <rect x="24" y="280" width="342" height="30" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="38" y="299" fill="rgba(255,255,255,.95)">
                {f('partnerScopedProcessing')}
              </text>
              <rect x="24" y="318" width="342" height="30" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.8" />
              <text x="38" y="337" fill="rgba(255,255,255,.97)">
                {f('privateIndex')}
              </text>
              <rect x="24" y="356" width="342" height="30" fill="#17171A" stroke="rgba(255,255,255,.28)" />
              <text x="38" y="375" fill="rgba(255,255,255,.95)">
                {f('authorisedPartnerOutput')}
              </text>
            </g>
            <text x="24" y="416" fontSize="6.8" letterSpacing=".8" fill="rgba(185,185,185,.8)">
              {f('calmControl')}
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
