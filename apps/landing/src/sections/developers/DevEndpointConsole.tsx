import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WF, type WfKey, codeToPlainText } from './devEngine.ts';
import { DevCodeBlock } from './DevCodeBlock.tsx';
import { DevCopyButton } from './DevCopyButton.tsx';

const WF_KEYS: WfKey[] = ['chain', 'simid', 'simup', 'ana', 'play'];

type DevEndpointConsoleProps = {
  onCopy: (label: string) => void;
};

export function DevEndpointConsole({ onCopy }: DevEndpointConsoleProps) {
  const { t } = useTranslation('common');
  const [wf, setWf] = useState<WfKey>('chain');
  const [expanded, setExpanded] = useState(false);

  const w = WF[wf];
  const resLines = expanded && w.resFull ? w.resFull : w.res;

  const wfLabels = t('developers.console.workflows', { returnObjects: true }) as Record<WfKey, string>;

  return (
    <section id="dev-console" className="dev-section" aria-label="Supported workflows and endpoint console">
      <header className="dev-dim-intro">
        <p className="dev-eyebrow uppercase">{t('developers.console.eyebrow')}</p>
        <h2 className="dev-h2b uppercase">{t('developers.console.title')}</h2>
        <p className="dev-lead">{t('developers.console.lead')}</p>
      </header>

      <div className="dev-seg" role="group" aria-label="Choose a workflow">
        {WF_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={wf === key}
            onClick={() => {
              setWf(key);
              setExpanded(false);
            }}
            className="uppercase"
          >
            {wfLabels[key]}
          </button>
        ))}
      </div>

      <div className="dev-console-panel">
        <div className="dev-console-head">
          <span className="dev-hudlbl uppercase">{w.title}</span>
          <span className="dev-truth uppercase">{t('developers.console.truth')}</span>
        </div>
        <div className="dev-console-body">
          <div>
            <div className="dev-codelbl">
              <span className="dev-lbl uppercase">{t('developers.console.requestLabel')}</span>
              <span className="dev-lbl-dim">{w.ep}</span>
            </div>
            <div className="dev-code dev-jsonwrap">
              <DevCopyButton getText={() => codeToPlainText(w.req)} onCopy={onCopy} />
              <DevCodeBlock lines={w.req} id="dev-wf-req" />
            </div>
          </div>
          <div>
            <div className="dev-codelbl">
              <span className="dev-lbl uppercase">{t('developers.console.responseLabel')}</span>
              <span className="dev-lbl-dim">{t('developers.console.envelopeNote')}</span>
            </div>
            <div className="dev-code dev-jsonwrap">
              <DevCopyButton getText={() => codeToPlainText(resLines)} onCopy={onCopy} />
              <DevCodeBlock lines={resLines} id="dev-wf-res" />
            </div>
            {w.resFull ? (
              <button
                type="button"
                className="dev-ghostbtn dev-json-expand uppercase"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? t('developers.console.collapse') : t('developers.console.expand')}
              </button>
            ) : null}
          </div>
          <div className="dev-console-side">
            <p className="dev-interp dev-wf-expl">{w.expl}</p>
            {w.async ? (
              <div
                className="dev-async uppercase"
                role="img"
                aria-label="Asynchronous job states: queued, then processing, then completed — or failed"
              >
                <span className="dev-lbl-dim">{t('developers.console.asyncLabel')}</span>
                <span className="dev-stt">QUEUED</span>
                <span className="dev-arr">→</span>
                <span className="dev-stt dev-stt-on">PROCESSING</span>
                <span className="dev-arr">→</span>
                <span className="dev-stt">COMPLETED</span>
                <span className="dev-arr">·</span>
                <span className="dev-stt">FAILED</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <p className="dev-lbl-dim dev-footnote">{t('developers.console.footnote')}</p>
    </section>
  );
}
