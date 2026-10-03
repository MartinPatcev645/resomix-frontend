import { useTranslation, Trans } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePoDefs } from './poDefs.ts';
import { BLOG } from '@/routes/blogLinks.ts';

/* S2 · Three product workflows + subordinate API rail. */
export function PoProducts() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = usePoDefs();
  const f = (key: string) => t(`product.figures.${key}`);

  return (
    <section className="po-sec po-section" id="po-s2">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.products.eyebrow')}</div>
        <h2 className="po-h2">{t('product.products.h2')}</h2>
        <p className="po-body-p po-copycol">{t('product.products.body')}</p>

        <div className="po-products">
          <div className="po-pm">
            <span className="po-q">{t('product.products.sdQ')}</span>
            <h3>{t('product.products.sdTitle')}</h3>
            <p><Trans i18nKey="product.products.sdBody" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.techno} /> }} /></p>
            <div className="po-mv">
              <svg viewBox="0 0 220 64" role="img" aria-label={t('product.products.sdAria')}>
                <circle cx="22" cy="32" r="11" fill={url('halo')} />
                <rect x="15" y="27" width="14" height="9" fill="#EE4A26" />
                <path className="po-sig" d="M 32 32 H 84" fill="none" stroke="#EE4A26" strokeWidth="1.2" />
                <g fontSize="7" letterSpacing=".8">
                  <rect x="92" y="10" width="120" height="14" fill="rgba(238,74,38,.12)" />
                  <text x="98" y="20" fill="#EE4A26">
                    {f('rank01')}
                  </text>
                  <text x="118" y="20" fill="rgba(255,255,255,.96)">
                    {f('score931')}
                  </text>
                  <text x="98" y="38" fill="rgba(255,255,255,.73)">
                    {f('rank02')}
                  </text>
                  <text x="118" y="38" fill="rgba(255,255,255,.83)">
                    {f('score924')}
                  </text>
                  <text x="98" y="54" fill="rgba(255,255,255,.67)">
                    {f('rank03')}
                  </text>
                  <text x="118" y="54" fill="rgba(255,255,255,.76)">
                    {f('score918')}
                  </text>
                </g>
              </svg>
            </div>
            <span className="po-rail">{t('product.products.sdRail')}</span>
            <button
              type="button"
              className="po-cta"
              onClick={() => navigate('/product/sonic-discovery')}
            >
              {t('product.products.sdCta')}
            </button>
          </div>

          <div className="po-pm">
            <span className="po-q">{t('product.products.tiQ')}</span>
            <h3>{t('product.products.tiTitle')}</h3>
            <p>{t('product.products.tiBody')}</p>
            <div className="po-mv">
              <svg viewBox="0 0 220 64" role="img" aria-label={t('product.products.tiAria')}>
                <g fontSize="6" fill="rgba(185,185,185,.72)">
                  <rect x="10" y="12" width="34" height="7" fill="rgba(255,255,255,.08)" />
                  <rect x="46" y="12" width="52" height="7" fill="rgba(255,255,255,.12)" />
                  <rect x="100" y="12" width="58" height="7" fill="rgba(238,74,38,.3)" />
                  <rect x="160" y="12" width="50" height="7" fill="rgba(255,255,255,.08)" />
                </g>
                <path
                  d="M 10 46 C 50 42, 80 34, 116 26 C 140 21, 170 28, 210 38"
                  fill="none"
                  stroke="rgba(255,255,255,.62)"
                  strokeWidth="1.4"
                />
                <circle cx="120" cy="26" r="2.2" fill="#EE4A26" />
              </svg>
            </div>
            <span className="po-rail">{t('product.products.tiRail')}</span>
            <button
              type="button"
              className="po-cta"
              onClick={() => navigate('/product/track-intelligence')}
            >
              {t('product.products.tiCta')}
            </button>
          </div>

          <div className="po-pm">
            <span className="po-q">{t('product.products.ciQ')}</span>
            <h3>{t('product.products.ciTitle')}</h3>
            <p><Trans i18nKey="product.products.ciBody" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.beyondTags} /> }} /></p>
            <div className="po-mv">
              <svg viewBox="0 0 220 64" role="img" aria-label={t('product.products.ciAria')}>
                <rect x="10" y="8" width="110" height="48" fill="none" stroke="rgba(255,255,255,.46)" strokeWidth="1.4" />
                <rect x="18" y="16" width="94" height="32" fill={url('cells')} />
                <path className="po-sig" d="M 124 32 H 152" fill="none" stroke="#EE4A26" strokeWidth="1.2" />
                <g fontSize="7" letterSpacing=".8">
                  <text x="160" y="22" fill="#EE4A26">
                    {f('rank01')}
                  </text>
                  <text x="180" y="22" fill="rgba(255,255,255,.96)">
                    {f('catShort')}
                  </text>
                  <text x="160" y="40" fill="rgba(255,255,255,.73)">
                    {f('rank02')}
                  </text>
                  <text x="180" y="40" fill="rgba(255,255,255,.83)">
                    {f('catShort')}
                  </text>
                  <text x="160" y="56" fill="rgba(255,255,255,.67)">
                    {f('rank03')}
                  </text>
                  <text x="180" y="56" fill="rgba(255,255,255,.76)">
                    {f('catShort')}
                  </text>
                </g>
              </svg>
            </div>
            <span className="po-rail">{t('product.products.ciRail')}</span>
            <button
              type="button"
              className="po-cta"
              onClick={() => navigate('/product/catalog-intelligence')}
            >
              {t('product.products.ciCta')}
            </button>
          </div>
        </div>

        <div className="po-api-rail po-chamfer">
          <div>
            <span className="po-lbl">{t('product.products.apiLbl')}</span>
            <h4>{t('product.products.apiTitle')}</h4>
            <p>{t('product.products.apiBody')}</p>
          </div>
          <div className="po-links">
            <button type="button" className="po-cta po-text-link" onClick={() => navigate('/developers')}>
              {t('product.products.apiCta')}
            </button>
            <span className="po-anno">{t('product.products.apiAnno')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
