import { useTranslation } from 'react-i18next';

export function RlQuote() {
  const { t } = useTranslation('common');

  return (
    <section className="rl-quote rl-section" id="rl-quote">
      <div className="rl-frame">
        <h2 className="rl-sr">{t('recordLabels.quote.srTitle')}</h2>
        <blockquote>
          <p>{t('recordLabels.quote.text')}</p>
          <cite>
            <b>{t('recordLabels.quote.name')}</b>
            {' · '}
            {t('recordLabels.quote.role')}
          </cite>
        </blockquote>
      </div>
    </section>
  );
}
