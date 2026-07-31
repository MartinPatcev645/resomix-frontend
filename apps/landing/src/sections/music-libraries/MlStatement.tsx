import { useTranslation } from 'react-i18next';

export function MlStatement() {
  const { t } = useTranslation('common');

  return (
    <section className="ml-statement ml-section" id="ml-statement">
      <div className="ml-frame">
        <h2 className="ml-sr">{t('musicLibraries.statement.srTitle')}</h2>
        <p className="ml-body">{t('musicLibraries.statement.body')}</p>
        <p className="ml-st">{t('musicLibraries.statement.engine')}</p>
      </div>
    </section>
  );
}
