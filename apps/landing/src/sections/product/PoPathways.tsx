import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/* S8 · Four decision pathways. */
export function PoPathways() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const paths = [
    {
      dec: 'p1Dec',
      body: 'p1Body',
      route: 'p1Route',
      cta: 'p1Cta',
      to: '/solutions/djs',
    },
    {
      dec: 'p2Dec',
      body: 'p2Body',
      route: 'p2Route',
      cta: 'p2Cta',
      to: '/solutions/producers',
    },
    {
      dec: 'p3Dec',
      body: 'p3Body',
      route: 'p3Route',
      cta: 'p3Cta',
      to: '/product/catalog-intelligence',
    },
    {
      dec: 'p4Dec',
      body: 'p4Body',
      route: 'p4Route',
      cta: 'p4Cta',
      to: '/developers',
    },
  ] as const;

  return (
    <section className="po-sec po-section" id="po-s8">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.pathways.eyebrow')}</div>
        <h2 className="po-h2">{t('product.pathways.h2')}</h2>
        <p className="po-body-p po-copycol">{t('product.pathways.body')}</p>

        <div className="po-paths">
          {paths.map((p) => (
            <div className="po-path" key={p.cta}>
              <div className="po-dec">{t(`product.pathways.${p.dec}`)}</div>
              <p>{t(`product.pathways.${p.body}`)}</p>
              <span className="po-route">{t(`product.pathways.${p.route}`)}</span>
              <button type="button" className="po-cta" onClick={() => navigate(p.to)}>
                {t(`product.pathways.${p.cta}`)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
