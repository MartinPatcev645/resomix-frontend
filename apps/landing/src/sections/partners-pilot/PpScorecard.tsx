import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCORECARD_PRIMARY,
  SCORECARD_DEEP,
  SCORECARD_OPTIONAL,
} from './ppData.ts';

function ScorecardRow({
  measure,
  assessment,
  targetSlot = 'agreed in scoping',
  resultSlot = 'measured in pilot',
  deep,
  open,
  onToggle,
}: {
  measure: string;
  assessment: string;
  targetSlot?: string;
  resultSlot?: string;
  deep?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onToggle?.();
    }
  };

  return (
    <div
      className={`pp-scrow${deep ? ' pp-sc-deep' : ''}`}
      data-open={open ? 'true' : 'false'}
      tabIndex={onToggle ? 0 : undefined}
      aria-expanded={onToggle ? open : undefined}
      onClick={onToggle}
      onKeyDown={onToggle ? onKeyDown : undefined}
    >
      <span className="pp-scrow-m uppercase">{measure}</span>
      <p>{assessment}</p>
      <span className="pp-slot uppercase">{targetSlot}</span>
      <span className="pp-slot uppercase">{resultSlot}</span>
    </div>
  );
}

export function PpScorecard() {
  const { t } = useTranslation('common');
  const [deepOpen, setDeepOpen] = useState(false);
  const [optOpen, setOptOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allRows = [...SCORECARD_PRIMARY, ...SCORECARD_DEEP];

  return (
    <section id="scorecard" aria-label="How relevance is measured" className="pp-section">
      <header className="pp-dim-intro">
        <p className="pp-eyebrow uppercase">{t('partnersPilot.scorecard.eyebrow')}</p>
        <h2 className="pp-h2b uppercase">{t('partnersPilot.scorecard.title')}</h2>
        <p className="pp-lead">{t('partnersPilot.scorecard.lead')}</p>
      </header>
      <div
        className={`pp-scorecard${deepOpen ? ' pp-show-deep' : ''}`}
        aria-label={t('partnersPilot.scorecard.tableAria')}
      >
        <div className="pp-scrow pp-schead">
          <span>{t('partnersPilot.scorecard.colMeasure')}</span>
          <span>{t('partnersPilot.scorecard.colAssessment')}</span>
          <span>{t('partnersPilot.scorecard.colTarget')}</span>
          <span>{t('partnersPilot.scorecard.colResult')}</span>
        </div>
        {allRows.map((row) => (
          <ScorecardRow
            key={row.measure}
            measure={row.measure}
            assessment={row.assessment}
            deep={row.deep}
            open={expandedRows[row.measure]}
            onToggle={() => toggleRow(row.measure)}
          />
        ))}
      </div>
      <p className="pp-lbl-dim pp-scorecard-note uppercase">
        {t('partnersPilot.scorecard.latencyNote')}
      </p>
      <button
        type="button"
        className="pp-ghostbtn pp-sc-morebtn uppercase"
        aria-expanded={deepOpen}
        onClick={() => setDeepOpen((o) => !o)}
      >
        {deepOpen
          ? t('partnersPilot.scorecard.deepBtnOpen')
          : t('partnersPilot.scorecard.deepBtnClosed')}
      </button>
      <button
        type="button"
        className="pp-ghostbtn uppercase"
        aria-expanded={optOpen}
        aria-controls="pp-optrows"
        onClick={() => setOptOpen((o) => !o)}
      >
        {optOpen
          ? t('partnersPilot.scorecard.optBtnOpen')
          : t('partnersPilot.scorecard.optBtnClosed')}
      </button>
      <div className={`pp-expandable${optOpen ? ' pp-open' : ''}`} id="pp-optrows">
        <div className="pp-scorecard" aria-label={t('partnersPilot.scorecard.optTableAria')}>
          {SCORECARD_OPTIONAL.map((row) => (
            <ScorecardRow
              key={row.measure}
              measure={row.measure}
              assessment={row.assessment}
              targetSlot={row.targetSlot}
              resultSlot={row.resultSlot}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
