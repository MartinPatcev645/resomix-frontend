import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MATCHES, type Match } from './ciEngine.ts';

interface CiFindConsoleProps {
  shortlist: Match[];
  onAddToShortlist: (match: Match) => void;
}

export function CiFindConsole({ shortlist, onAddToShortlist }: CiFindConsoleProps) {
  const { t } = useTranslation('common');
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const [previewing, setPreviewing] = useState<number | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const toggleRow = (i: number) => {
    setOpenRow((prev) => (prev === i ? null : i));
  };

  const handleAdd = (tr: Match) => {
    if (shortlist.some((s) => s.t === tr.t) || added.has(tr.t)) return;
    onAddToShortlist(tr);
    setAdded((prev) => new Set(prev).add(tr.t));
  };

  return (
    <section id="ci-find" className="ci-section" aria-label="Find the tracks your team already owns">
      <header className="ci-dim-intro">
        <p className="ci-eyebrow uppercase">{t('catalogueIntelligence.find.eyebrow')}</p>
        <h2 className="ci-h2b uppercase">{t('catalogueIntelligence.find.title')}</h2>
        <p className="ci-lead">{t('catalogueIntelligence.find.lead')}</p>
      </header>
      <div className="ci-console">
        <div className="ci-console-head">
          <span className="ci-hudlbl uppercase">{t('catalogueIntelligence.find.head')}</span>
          <span className="ci-truth uppercase">{t('catalogueIntelligence.find.truth')}</span>
        </div>
        <div className="ci-console-body">
          <div className="ci-ref-row">
            <span className="ci-lbl uppercase">{t('catalogueIntelligence.find.refLabel')}</span>
            <span>
              <b style={{ fontFamily: 'Fira Code, monospace', fontWeight: 500 }}>COLD LATITUDE</b>{' '}
              <span className="ci-rartist">Nia Voss · 2026 · current release</span>
            </span>
            <span className="ci-chip">124 BPM</span>
            <span className="ci-chip">dark · rolling</span>
          </div>
          <ol
            className={`ci-matches list-none m-0 p-0${showExtra ? ' ci-show-extra' : ''}`}
            aria-live="polite"
          >
            {MATCHES.map((tr, i) => {
              const isOpen = openRow === i;
              const isAdded = added.has(tr.t) || shortlist.some((s) => s.t === tr.t);
              return (
                <li
                  key={tr.t}
                  className={`ci-rrow${tr.extra ? ' ci-rrow-extra' : ''}`}
                  data-open={isOpen ? 'true' : 'false'}
                  data-old={tr.old ? 'true' : undefined}
                >
                  <button
                    type="button"
                    className="ci-rhead"
                    aria-expanded={isOpen}
                    onClick={() => toggleRow(i)}
                  >
                    <span className="ci-rank">0{i + 1}</span>
                    <span className="ci-ryear">{tr.year}</span>
                    <span>
                      <span className="ci-rtitle">{tr.t}</span>
                      <span className="ci-rartist">{tr.a}</span>
                      <span className="ci-rattrs">
                        <span className="ci-rattr">{tr.label}</span>
                        {tr.fams.map((f, fi) => (
                          <span key={f} className={`ci-rattr${fi === 0 ? ' ci-rattr-hot' : ''}`}>
                            {f}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="ci-exposure">
                      {tr.exp} · SAMPLE
                    </span>
                    <span className="ci-score">{tr.sc}</span>
                    <span className="ci-rcaret">▾</span>
                  </button>
                  <div className="ci-rpanel">
                    <span className="ci-lbl uppercase">{t('catalogueIntelligence.find.expanderLabel')}</span>
                    <p className="ci-interp mt-[var(--px-10)]">
                      {tr.why}
                      {tr.old && (
                        <>
                          {' '}
                          <b>[illustrative pilot result]</b>
                        </>
                      )}
                    </p>
                    <div className="ci-mactions">
                      <button
                        type="button"
                        className="ci-iconbtn"
                        aria-pressed={previewing === i}
                        aria-label={`Preview ${tr.t} (simulated)`}
                        onClick={() => setPreviewing((prev) => (prev === i ? null : i))}
                      >
                        {previewing === i ? '❚❚ previewing' : '▶ preview'}
                      </button>
                      <button
                        type="button"
                        className="ci-iconbtn"
                        aria-pressed={isAdded}
                        aria-label={`Add ${tr.t} to the review shortlist`}
                        onClick={() => handleAdd(tr)}
                      >
                        {isAdded ? '✓ on shortlist' : '+ review shortlist'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="ci-iconbtn ci-show-more"
            aria-expanded={showExtra}
            onClick={() => setShowExtra((v) => !v)}
          >
            {showExtra
              ? t('catalogueIntelligence.find.showFewer')
              : t('catalogueIntelligence.find.showMore')}
          </button>
          <div className="ci-results-foot">
            <span className="ci-lbl-dim">{t('catalogueIntelligence.find.footNote')}</span>
            <span className="ci-lbl" style={{ color: 'var(--color-primary)' }}>
              {t('catalogueIntelligence.find.shortlistCount', { count: shortlist.length })}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
