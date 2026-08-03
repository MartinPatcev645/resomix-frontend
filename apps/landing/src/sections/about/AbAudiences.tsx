import { useTranslation } from 'react-i18next';

interface AbAudienceItem {
  title: string;
  body: string;
  chip: string;
}

/* S9 · Who Resomix is for — two environments, each with its own audience rows. */
export function AbAudiences() {
  const { t } = useTranslation('common');

  const individualItems = t('about.audiences.individual.items', { returnObjects: true }) as AbAudienceItem[];
  const catalogueItems = t('about.audiences.catalogue.items', { returnObjects: true }) as AbAudienceItem[];

  return (
    <section className="ab-sec ab-section" id="ab-s9">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.audiences.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.audiences.h2')}</h2>
        <div className="ab-envs">
          <div className="ab-env">
            <div className="ab-t">{t('about.audiences.individual.title')}</div>
            {individualItems.map((item) => (
              <div className="ab-aud" key={item.title}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </div>
                <span className="ab-chip">{item.chip}</span>
              </div>
            ))}
          </div>
          <div className="ab-env">
            <div className="ab-t">{t('about.audiences.catalogue.title')}</div>
            {catalogueItems.map((item) => (
              <div className="ab-aud" key={item.title}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </div>
                <span className="ab-chip">{item.chip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
