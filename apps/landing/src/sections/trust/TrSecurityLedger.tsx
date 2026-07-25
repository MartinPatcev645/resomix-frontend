import { useTranslation } from 'react-i18next';
import { TrLedgerRow } from './TrLedgerRow.tsx';
import { SECURITY_LEDGER } from './trData.ts';

export function TrSecurityLedger() {
  const { t } = useTranslation('common');

  return (
    <section id="security" aria-label="Security controls operating today" className="tr-section">
      <header className="tr-dim-intro">
        <p className="tr-eyebrow uppercase">{t('trust.security.eyebrow')}</p>
        <h2 className="tr-h2b uppercase">{t('trust.security.title')}</h2>
      </header>
      <div
        className="tr-ledger"
        role="table"
        aria-label="Security control ledger with status and safe public description"
      >
        {SECURITY_LEDGER.map((row) => (
          <TrLedgerRow key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}
