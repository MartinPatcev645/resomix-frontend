import { useTranslation } from 'react-i18next';
import './sd-flow-steps.css';

interface FlowStep {
  name: string;
  text: string;
}

/**
 * The discovery flow as plain, readable copy.
 *
 * The flow figure above it labels stages 01 to 04 with SVG `<text>`, which AI assistants skip when
 * they read a page (ShelfSignal report, September 2026) and which is awkward for screen readers.
 * This is the same five steps in ordinary HTML, kept deliberately simple. The build also emits
 * them as `HowTo` structured data from the same strings (vite.config.ts).
 */
export function SdFlowSteps() {
  const { t } = useTranslation('common');
  const steps = t('sonicDiscovery.steps.items', { returnObjects: true }) as FlowStep[] | string;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div className="sd-col">
      <div className="sd-steps">
        <h3 className="sd-steps-title">{t('sonicDiscovery.steps.title')}</h3>
        <ol className="sd-steps-list">
          {steps.map((step, i) => (
            <li key={step.name}>
              <span className="sd-steps-n font-fira" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <span className="sd-steps-name">{step.name}</span>
                <span className="sd-steps-text">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
