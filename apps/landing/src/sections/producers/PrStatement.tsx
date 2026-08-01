import { useTranslation } from 'react-i18next';

export function PrStatement() {
  const { t } = useTranslation('common');

  return (
    <section className="pr-statement pr-section" id="pr-statement">
      <div className="pr-frame">
        <h2 className="pr-sr">{t('producers.statement.srTitle')}</h2>
        <p className="pr-body">{t('producers.statement.bridge')}</p>
        <p className="pr-body">{t('producers.statement.inspiration')}</p>
        <p className="pr-st">{t('producers.statement.pull')}</p>
      </div>
    </section>
  );
}
