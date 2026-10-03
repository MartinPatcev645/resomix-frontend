import { Trans, useTranslation } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';
import { TrStatusChip } from './TrStatusChip.tsx';
import type { LedgerRowDef } from './trData.ts';

/** Blog destination per ledger row, from the interlinking map. Only MB-32 is mapped. */
const LEDGER_BLOG: Record<string, string | undefined> = { noTraining: BLOG.story };

interface TrLedgerRowProps {
  row: LedgerRowDef;
  open?: boolean;
  collapsible?: boolean;
  onToggle?: () => void;
  grid?: boolean;
}

export function TrLedgerRow({ row, open = false, collapsible = false, onToggle, grid = false }: TrLedgerRowProps) {
  const { t } = useTranslation('common');
  const cellRole = grid ? 'gridcell' : 'cell';

  const handleKeyDown = (ev: React.KeyboardEvent) => {
    if (!collapsible || !onToggle) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className="tr-lrow"
      role="row"
      data-open={collapsible ? String(open) : undefined}
      tabIndex={collapsible ? 0 : undefined}
      aria-expanded={collapsible ? open : undefined}
      onClick={collapsible ? onToggle : undefined}
      onKeyDown={handleKeyDown}
    >
      <span className="tr-lrow-c uppercase" role={cellRole}>
        {t(row.controlKey)}
      </span>
      <span role={cellRole}>
        <TrStatusChip status={row.status} />
      </span>
      <p role={cellRole}>
        {/* MB-32 sits on the no-training row. */}
        <Trans
          i18nKey={row.descriptionKey}
          components={{ a: <a className="rx-copylink" href={LEDGER_BLOG[row.id] ?? ''} /> }}
        />
        {row.legalDisclosureKey ? (
          <>
            {' '}
            <span className="tr-docref uppercase">{t(row.legalDisclosureKey)}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
