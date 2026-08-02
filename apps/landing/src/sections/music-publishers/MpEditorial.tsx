import { useTranslation } from 'react-i18next';

/* S2 · Editorial opening. */
export function MpEditorial() {
  const { t } = useTranslation('common');

  return (
    <section className="mp-editorial mp-section" id="mp-s2">
      <div className="mp-wrap">
        <div className="mp-copycol">
          <p className="mp-body-p">{t('musicPublishers.editorial.p1')}</p>
          <p className="mp-body-p">{t('musicPublishers.editorial.p2')}</p>
        </div>
        <blockquote className="mp-pullquote">{t('musicPublishers.editorial.pull')}</blockquote>
        <p className="mp-body-p mp-after-quote">{t('musicPublishers.editorial.afterQuote')}</p>
        <div className="mp-subject-line" aria-hidden="true" />
      </div>
    </section>
  );
}
