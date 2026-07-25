import { useTranslation } from 'react-i18next';
import { STAGES } from './ppData.ts';

interface PpMethodProps {
  selectedStage: number;
  onSelectStage: (index: number) => void;
}

function isPathChipHot(step: string): boolean {
  return step.includes('.done') || step.toLowerCase().includes('pyxis');
}

export function PpMethod({ selectedStage, onSelectStage }: PpMethodProps) {
  const { t } = useTranslation('common');
  const stage = STAGES[selectedStage];

  return (
    <section id="method" aria-label="How the pilot runs" className="pp-section">
      <header className="pp-dim-intro">
        <p className="pp-eyebrow uppercase">{t('partnersPilot.method.eyebrow')}</p>
        <h2 className="pp-h2b uppercase">{t('partnersPilot.method.title')}</h2>
        <p className="pp-lead">{t('partnersPilot.method.lead')}</p>
      </header>
      <div className="pp-stagebtns" role="group" aria-label="Select a pilot stage">
        {STAGES.map((s, i) => (
          <button
            key={s.t}
            type="button"
            className="pp-stagebtn uppercase"
            aria-pressed={i === selectedStage}
            onClick={() => onSelectStage(i)}
          >
            {`0${i + 1} ${s.t}`}
          </button>
        ))}
      </div>
      <div className="pp-stagepanel">
        <span className="pp-hudlbl pp-hudtop-l uppercase">{stage.lbl}</span>
        <span className="pp-truth pp-hudtop-r uppercase">
          {t('partnersPilot.shared.timelineTruth')}
        </span>
        <div className="pp-stagecols">
          <div>
            <span className="pp-stage-k uppercase">{t('partnersPilot.method.resomixDoes')}</span>
            <ul>
              {stage.rx.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="pp-stage-k uppercase">{t('partnersPilot.method.yourTeamDoes')}</span>
            <ul>
              {stage.pt.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="pp-stage-k uppercase">{t('partnersPilot.method.evidence')}</span>
            <ul>
              {stage.ev.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pp-stage-extra">
          {stage.path ? (
            <span className="pp-path-rail">
              {stage.path.map((step, si) => (
                <span key={step} className="pp-path-step">
                  <span
                    className={`pp-chip uppercase${isPathChipHot(step) ? ' pp-chip-hot' : ''}`}
                  >
                    {step}
                  </span>
                  {si < stage.path!.length - 1 ? (
                    <span className="pp-lbl-dim pp-path-arrow" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                </span>
              ))}
            </span>
          ) : null}
          {stage.extra.map((chip) => (
            <span key={chip} className="pp-chip uppercase">
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
