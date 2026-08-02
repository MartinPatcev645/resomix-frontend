import { useTranslation } from 'react-i18next';

/* S8 · What we stand for — four numbered value slabs. */
export function AbValues() {
  const { t } = useTranslation('common');

  const slabs = ['v1', 'v2', 'v3', 'v4'] as const;

  return (
    <section className="ab-sec ab-section" id="ab-s8">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.values.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.values.h2')}</h2>
        <div className="ab-slabs">
          {slabs.map((key, i) => (
            <div className="ab-slab" key={key}>
              <span className="ab-n">{`0${i + 1}`}</span>
              <div>
                <h3>{t(`about.values.${key}.title`)}</h3>
                <p>{t(`about.values.${key}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
