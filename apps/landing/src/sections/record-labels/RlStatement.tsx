import { useTranslation } from 'react-i18next';

export function RlStatement() {
  const { t } = useTranslation('common');

  return (
    <section className="rl-statement rl-section" id="rl-statement">
      <div className="rl-frame">
        <h2 className="rl-sr">{t('recordLabels.statement.srTitle')}</h2>
        <p className="rl-st">{t('recordLabels.statement.body')}</p>
      </div>
    </section>
  );
}
