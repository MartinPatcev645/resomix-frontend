import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function PpHandling() {
  const { t } = useTranslation('common');

  const trustItems = t('partnersPilot.handling.trustItems', {
    returnObjects: true,
  }) as { text: string; subjectLabel?: boolean }[];

  return (
    <section id="handling" aria-label="Catalogue handling and control" className="pp-section">
      <header className="pp-dim-intro">
        <p className="pp-eyebrow uppercase">{t('partnersPilot.handling.eyebrow')}</p>
        <h2 className="pp-h2b uppercase">{t('partnersPilot.handling.title')}</h2>
      </header>
      <div className="pp-read">
        <ul className="pp-trustlist">
          {trustItems.map((item, i) => (
            <li key={i}>
              <span>
                {item.text}
                {item.subjectLabel ? (
                  <>
                    {' '}
                    <span className="pp-truth pp-truth-hot uppercase">
                      {t('partnersPilot.shared.subjectLabel')}
                    </span>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="pp-ctarow pp-handling-links">
          <Link className="pp-bracket uppercase" to="/trust">
            {t('partnersPilot.handling.trustLink')}
          </Link>
          <Link className="pp-bracket uppercase" to="/partners">
            {t('partnersPilot.handling.partnerLink')}
          </Link>
        </div>
      </div>
    </section>
  );
}
