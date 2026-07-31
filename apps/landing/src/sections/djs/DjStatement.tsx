import { useTranslation } from 'react-i18next';

export function DjStatement() {
  const { t } = useTranslation('common');

  return (
    <section className="dj-statement dj-section" id="dj-statement">
      <div className="dj-frame">
        <h2 className="dj-sr">{t('djs.statement.srTitle')}</h2>
        <p className="dj-body">{t('djs.statement.p1')}</p>
        <p className="dj-body">{t('djs.statement.p2')}</p>
        <p className="dj-st">{t('djs.statement.engine')}</p>
      </div>
    </section>
  );
}
