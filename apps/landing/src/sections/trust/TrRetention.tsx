import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrLedgerRow } from './TrLedgerRow.tsx';
import { RETENTION_LEDGER, RETENTION_LIMITS, type LedgerRowDef } from './trData.ts';

function CollapsibleLedger({
  rows,
  ariaLabel,
}: {
  rows: LedgerRowDef[];
  ariaLabel: string;
}) {
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  const toggle = useCallback((id: string) => {
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <div className="tr-ledger tr-m-collapse" role="treegrid" aria-label={ariaLabel}>
      {rows.map((row) => (
        <TrLedgerRow
          key={row.id}
          row={row}
          collapsible
          grid
          open={Boolean(openRows[row.id])}
          onToggle={() => toggle(row.id)}
        />
      ))}
    </div>
  );
}

export function TrRetention() {
  const { t } = useTranslation('common');

  return (
    <section id="retention" aria-label="Deletion, offboarding and beta limits" className="tr-section">
      <header className="tr-dim-intro">
        <p className="tr-eyebrow uppercase">{t('trust.retention.eyebrow')}</p>
        <h2 className="tr-h2b uppercase">{t('trust.retention.title')}</h2>
      </header>

      <CollapsibleLedger
        rows={RETENTION_LEDGER}
        ariaLabel="Retention register by data category"
      />

      <p className="tr-note">
        <b>{t('trust.retention.legalNoteBold')}</b>
        {t('trust.retention.legalNoteRest')}
      </p>

      <header className="tr-dim-intro tr-limits-intro">
        <h2 className="tr-h2b uppercase">{t('trust.retention.limitsTitle')}</h2>
      </header>

      <CollapsibleLedger
        rows={RETENTION_LIMITS}
        ariaLabel="Explicit boundaries: controls and assurances Resomix does not currently claim"
      />
    </section>
  );
}
