import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ButtonHeavyRight, ButtonSleek } from '@resomix/ui';
import { BASE_BETA_URL } from '@resomix/config';

export function CtaSplit() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section id="cta" aria-label="Get started">
      <div className="product-cta-grid">
        <div>
          <p className="product-microtag product-microtag-muted">{t('product.cta.leftTag')}</p>
          <h3 className="product-cta-heading m-0 font-helvetica uppercase font-light text-[length:var(--px-33)] leading-[var(--px-38)] text-[var(--color-primary)]">
            {t('product.cta.leftTitle')}
          </h3>
          <div className="product-cta-btn-wrap">
            <ButtonHeavyRight
              text={t('product.cta.leftBtn')}
              onClick={() => {
                window.location.href = BASE_BETA_URL;
              }}
            />
          </div>
          <p className="product-cta-note">{t('product.cta.leftNote')}</p>
        </div>

        <div className="product-cta-divider" aria-hidden="true" />

        <div>
          <p className="product-microtag product-microtag-muted">{t('product.cta.rightTag')}</p>
          <h3 className="product-cta-heading m-0 font-helvetica uppercase font-light text-[length:var(--px-33)] leading-[var(--px-38)] text-[var(--color-primary)]">
            {t('product.cta.rightTitle')}
          </h3>
          <div className="product-cta-btn-wrap">
            <ButtonSleek text={t('product.cta.rightBtn')} transparent onClick={() => navigate('/partners/pilot')} />
          </div>
          <p className="product-cta-note">{t('product.cta.rightNote')}</p>
        </div>
      </div>
    </section>
  );
}
