import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const LEGAL_URL = 'https://support.resomix.com';

export function PnControl() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const statements = t('partners.control.statements', { returnObjects: true }) as string[];

  return (
    <section id="control" aria-label="Partner control and current status" className="pn-section">
      <header className="pn-dim-intro">
        <p className="pn-eyebrow uppercase">{t('partners.control.eyebrow')}</p>
        <h2 className="pn-h2b uppercase">{t('partners.control.title')}</h2>
      </header>
      <ul className="pn-trustlist">
        {statements.map((text) => (
          <li key={text}>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="pn-ctarow mt-[var(--px-24)]">
        <button
          type="button"
          className="pn-bracket"
          onClick={() => navigate('/partners/pilot')}
        >
          {t('partners.control.linkPilot')}
        </button>
        <button type="button" className="pn-bracket" onClick={() => navigate('/developers')}>
          {t('partners.control.linkApi')}
        </button>
        <button
          type="button"
          className="pn-bracket"
          onClick={() => navigate('/trust')}
        >
          [ View Trust, Rights & Security ]
        </button>
        <a
          className="pn-bracket"
          href={LEGAL_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('partners.control.linkLegal')}
        </a>
      </div>
    </section>
  );
}
