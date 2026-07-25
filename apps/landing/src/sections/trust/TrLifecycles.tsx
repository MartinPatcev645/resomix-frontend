import { useCallback, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { TrStatusChip } from './TrStatusChip.tsx';
import {
  LIFECYCLE_COLUMNS,
  LIFECYCLE_ROWS,
  LIFECYCLE_TAB_ORDER,
  type LifecycleColumnId,
  type LifecycleRowId,
} from './trData.ts';

const TAB_INDEX: Record<LifecycleColumnId, string> = {
  temp: '1',
  library: '2',
  partner: '3',
};

export function TrLifecycles() {
  const { t } = useTranslation('common');
  const [selectedTab, setSelectedTab] = useState<LifecycleColumnId>('temp');
  const [openRows, setOpenRows] = useState<Record<LifecycleRowId, boolean>>({
    purpose: false,
    access: false,
    publicVisibility: false,
    retention: true,
    deletionTrigger: false,
    trainingUse: false,
  });

  const setTab = useCallback((id: LifecycleColumnId) => {
    setSelectedTab(id);
  }, []);

  const onTabKeyDown = (ev: KeyboardEvent<HTMLButtonElement>, current: LifecycleColumnId) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    const idx = LIFECYCLE_TAB_ORDER.indexOf(current);
    const next =
      LIFECYCLE_TAB_ORDER[
        (idx + (ev.key === 'ArrowRight' ? 1 : -1) + LIFECYCLE_TAB_ORDER.length) %
          LIFECYCLE_TAB_ORDER.length
      ];
    setSelectedTab(next);
    const btn = ev.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
      `[data-lc="${TAB_INDEX[next]}"]`,
    );
    btn?.focus();
  };

  const toggleRow = (id: LifecycleRowId) => {
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onRowKeyDown = (ev: KeyboardEvent<HTMLDivElement>, id: LifecycleRowId) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      toggleRow(id);
    }
  };

  const renderCell = (rowId: LifecycleRowId, columnId: LifecycleColumnId) => {
    const baseKey = `trust.lifecycles.rows.${rowId}`;
    if (rowId === 'retention' && columnId === 'temp') {
      return (
        <>
          <b>{t(`${baseKey}.tempBold`)}</b>
          {t(`${baseKey}.tempRest`)}
        </>
      );
    }
    return t(`${baseKey}.${columnId}`);
  };

  return (
    <section id="lifecycles" aria-label="Three audio lifecycles" className="tr-section">
      <header className="tr-dim-intro">
        <p className="tr-eyebrow uppercase">{t('trust.lifecycles.eyebrow')}</p>
        <h2 className="tr-h2b uppercase">{t('trust.lifecycles.title')}</h2>
      </header>

      <div className="tr-lifetabs" role="tablist" aria-label="Choose a lifecycle">
        {LIFECYCLE_TAB_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className="tr-lifetab uppercase"
            role="tab"
            data-lc={TAB_INDEX[id]}
            aria-selected={selectedTab === id}
            onClick={() => setTab(id)}
            onKeyDown={(ev) => onTabKeyDown(ev, id)}
          >
            {t(`trust.lifecycles.tabs.${id}`)}
          </button>
        ))}
      </div>

      <div
        className="tr-lifecycle"
        role="treegrid"
        aria-label="Comparison of the three audio lifecycles: temporary reference upload, private Resomix Library, partner catalogue"
      >
        <div className="tr-lc-head" role="row">
          <div role="columnheader" aria-hidden="true" />
          {LIFECYCLE_COLUMNS.map((col) => (
            <div key={col.id} role="columnheader">
              <span className="tr-lc-t uppercase">{t(col.titleKey)}</span>
              <TrStatusChip status={col.status} />
            </div>
          ))}
        </div>

        {LIFECYCLE_ROWS.map((row) => (
          <div
            key={row.id}
            className="tr-lc-row"
            role="row"
            data-open={String(openRows[row.id])}
            tabIndex={0}
            aria-expanded={openRows[row.id]}
            onClick={() => toggleRow(row.id)}
            onKeyDown={(ev) => onRowKeyDown(ev, row.id)}
          >
            <span className="tr-lc-k uppercase" role="rowheader">
              {t(row.labelKey)}
            </span>
            {LIFECYCLE_COLUMNS.map((col) => (
              <div
                key={col.id}
                role="gridcell"
                className="tr-lc-cell"
                data-lc={TAB_INDEX[col.id]}
                data-on={String(selectedTab === col.id)}
              >
                {renderCell(row.id, col.id)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="tr-note">
        <b>{t('trust.lifecycles.noteBold')}</b>
        {t('trust.lifecycles.noteRest')}
      </p>
    </section>
  );
}
