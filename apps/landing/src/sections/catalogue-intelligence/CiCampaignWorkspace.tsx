import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CAMPS, QUEUE, QSTATES, type Match } from './ciEngine.ts';

interface CiCampaignWorkspaceProps {
  shortlist: Match[];
}

type CampKey = 'ed' | 'sync' | 'ar';

const CAMP_KEYS: CampKey[] = ['ed', 'sync', 'ar'];

function statusClass(status: string) {
  if (status === 'SHORTLISTED') return 'ci-st-conf';
  if (status === 'REVIEWED') return 'ci-st-ok';
  return 'ci-st-rev';
}

export function CiCampaignWorkspace({ shortlist }: CiCampaignWorkspaceProps) {
  const { t } = useTranslation('common');
  const [campSel, setCampSel] = useState<CampKey>('ed');
  const [queueStates, setQueueStates] = useState<number[]>(() => QUEUE.map(() => 0));

  const camp = CAMPS[campSel];

  const cycleStatus = (idx: number) => {
    setQueueStates((prev) => {
      const next = [...prev];
      next[idx] = (next[idx] + 1) % QSTATES.length;
      return next;
    });
  };

  return (
    <section id="ci-campaigns" className="ci-section" aria-label="Campaigns, briefs and release research">
      <header className="ci-dim-intro">
        <p className="ci-eyebrow uppercase">{t('catalogueIntelligence.campaigns.eyebrow')}</p>
        <h2 className="ci-h2b uppercase">{t('catalogueIntelligence.campaigns.title')}</h2>
      </header>

      <div className="ci-seg" role="group" aria-label={t('catalogueIntelligence.campaigns.segLabel')}>
        {CAMP_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={campSel === key}
            onClick={() => setCampSel(key)}
          >
            {t(`catalogueIntelligence.campaigns.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className="ci-workspace mt-[var(--px-28)]">
        <div className="ci-ws-brief">
          <span className="ci-hudlbl uppercase">{camp.lbl}</span>
          <p className="ci-q">{camp.q}</p>
          <p className="ci-body" style={{ fontSize: 'var(--px-15)' }}>
            {camp.copy}
          </p>
          <p className="ci-lbl-dim mt-[var(--px-20)]">{camp.note}</p>
        </div>
        <div className="ci-ws-list">
          <span className="ci-hudlbl uppercase">{t('catalogueIntelligence.campaigns.listLabel')}</span>
          <ol className="list-none m-0 mt-[var(--px-12)] p-0" aria-live="polite">
            {shortlist.map((s, i) => (
              <li key={s.t} className="ci-ws-item">
                <span className="ci-rank">S{i + 1}</span>
                <span>
                  {s.t} · {s.year}{' '}
                  <span className="ci-meta">{s.a} · added from reference search</span>
                </span>
                <span className="ci-st ci-st-conf">SHORTLISTED</span>
                <span className="ci-meta">you</span>
              </li>
            ))}
            {camp.items.map(([title, meta, status], i) => (
              <li key={title} className="ci-ws-item">
                <span className="ci-rank">0{i + 1}</span>
                <span>
                  {title} <span className="ci-meta">{meta}</span>
                </span>
                <span className={`ci-st ${statusClass(status)}`}>{status}</span>
                <span className="ci-meta">cat. team</span>
              </li>
            ))}
          </ol>
          <div className="mt-[var(--px-28)] border-t border-dotted border-white/10 pt-[var(--px-20)]">
            <span className="ci-hudlbl uppercase">{t('catalogueIntelligence.campaigns.queueLabel')}</span>
            <div className="ci-queue border-0 mt-[var(--px-8)]">
              {QUEUE.map((q, i) => {
                const st = queueStates[i];
                const stClass = st === 2 ? 'ci-st-ok' : st === 1 ? 'ci-st-conf' : 'ci-st-rev';
                return (
                  <div key={q.act} className="ci-qitem">
                    <span className="ci-act">{q.act}</span>
                    <span className="ci-why">
                      {q.why}{' '}
                      <span className="ci-lbl-dim">{t('catalogueIntelligence.campaigns.sampleEvidence')}</span>
                    </span>
                    <span className="ci-own">{q.own}</span>
                    <button
                      type="button"
                      className={`ci-st ${stClass}`}
                      aria-label={`Cycle review status for: ${q.act} (simulated)`}
                      onClick={() => cycleStatus(i)}
                    >
                      {QSTATES[st]}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="ci-lbl-dim mt-[var(--px-16)]">{t('catalogueIntelligence.campaigns.listFoot')}</p>
        </div>
      </div>
    </section>
  );
}
