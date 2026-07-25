import { useTranslation } from 'react-i18next';
import { TrLedgerRow } from './TrLedgerRow.tsx';
import { GLANCE_LEDGER } from './trData.ts';

export function TrGlanceLedger() {
  const { t } = useTranslation('common');

  return (
    <section id="glance" aria-label="Control status at a glance" className="tr-section">
      <header className="tr-dim-intro">
        <p className="tr-eyebrow uppercase">{t('trust.glance.eyebrow')}</p>
        <h2 className="tr-h2b uppercase">{t('trust.glance.title')}</h2>
      </header>
      <div className="tr-ledger" role="table" aria-label="Public control ledger, grouped by status">
        {GLANCE_LEDGER.map((group) => (
          <div key={group.groupKey}>
            <span className="tr-lgroup uppercase">{t(group.groupKey)}</span>
            {group.rows.map((row) => (
              <TrLedgerRow key={row.id} row={row} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
