import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scoreOf, type Track } from './sdEngine.ts';

interface SdShortlistProps {
  shortlist: Track[];
  onReorder: (from: number, to: number) => void;
  onRemove: (track: Track) => void;
}

export function SdShortlist({ shortlist, onReorder, onRemove }: SdShortlistProps) {
  const { t } = useTranslation('common');
  const [saveNote, setSaveNote] = useState(t('sonicDiscovery.shortlist.note'));

  const handleSave = () => {
    setSaveNote(
      shortlist.length
        ? t('sonicDiscovery.shortlist.savedNote')
        : t('sonicDiscovery.shortlist.savedEmpty'),
    );
  };

  return (
    <section id="sd-playlist" className="sd-section" aria-label="From shortlist to playlist">
      <header className="sd-dim-intro">
        <p className="sd-eyebrow uppercase">{t('sonicDiscovery.shortlist.eyebrow')}</p>
        <h2 className="sd-h2b uppercase">{t('sonicDiscovery.shortlist.title')}</h2>
        <p className="sd-lead">{t('sonicDiscovery.shortlist.lead')}</p>
      </header>
      <div className="sd-flowwrap">
        <span className="sd-hudlbl uppercase">{t('sonicDiscovery.shortlist.head')}</span>
        <span className="sd-hud-truth sd-truth uppercase">{t('sonicDiscovery.shortlist.truth')}</span>
        {shortlist.length === 0 && (
          <p className="sd-flow-empty">{t('sonicDiscovery.shortlist.empty')}</p>
        )}
        {shortlist.length > 0 && (
          <ol className="sd-pathlist">
            {shortlist.map((tr, i) => (
              <li key={tr.t}>
                <span className="sd-rank">0{i + 1}</span>
                <span>
                  {tr.t}{' '}
                  <span className="sd-pmeta">
                    {tr.a} · {tr.bpm} BPM · {tr.key} · match {scoreOf(tr)}%
                  </span>
                </span>
                <span className="sd-pacts">
                  <button
                    type="button"
                    className="sd-iconbtn min-h-[var(--px-44)] min-w-[var(--px-44)]"
                    aria-label={`Move ${tr.t} earlier`}
                    onClick={() => i > 0 && onReorder(i, i - 1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="sd-iconbtn min-h-[var(--px-44)] min-w-[var(--px-44)]"
                    aria-label={`Move ${tr.t} later`}
                    onClick={() => i < shortlist.length - 1 && onReorder(i, i + 1)}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="sd-iconbtn min-h-[var(--px-44)] min-w-[var(--px-44)]"
                    aria-label={`Remove ${tr.t} from the shortlist`}
                    onClick={() => onRemove(tr)}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="sd-pathfoot">
          <button type="button" className="sd-pill sd-pill-line uppercase" onClick={handleSave}>
            {t('sonicDiscovery.shortlist.save')}
          </button>
          <span className="sd-lbl-dim">{saveNote}</span>
        </div>
      </div>
    </section>
  );
}
