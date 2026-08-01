import { useTranslation } from 'react-i18next';

export function SaIdea() {
  const { t } = useTranslation('common');

  return (
    <section className="sa-idea sa-section" id="sa-idea">
      <div className="sa-frame">
        <h2 className="sa-sr">{t('syncAgencies.idea.srTitle')}</h2>
        <p className="sa-body">{t('syncAgencies.idea.complexities')}</p>
        <p className="sa-q">{t('syncAgencies.idea.whatIf')}</p>
        <p className="sa-body">{t('syncAgencies.idea.dream')}</p>
      </div>
    </section>
  );
}
