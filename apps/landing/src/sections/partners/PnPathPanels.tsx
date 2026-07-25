import { useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTE_IDS, type RouteId } from './pnData.ts';

function statusClass(st: string): string {
  if (st === 'LIVE') return 'pn-st-live';
  if (st.includes('SCOPING')) return 'pn-st-plan';
  return 'pn-st-avail';
}

interface PnPathPanelsProps {
  activePath: RouteId;
  onSelectPath: (id: RouteId) => void;
}

export function PnPathPanels({ activePath, onSelectPath }: PnPathPanelsProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const handleHeadKey = (id: RouteId) => (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onSelectPath(id);
    }
  };

  const goDest = useCallback(
    (id: RouteId) => {
      if (id === 'pilot') navigate('/partners/pilot');
      else if (id === 'api') navigate('/developers');
      else document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    },
    [navigate],
  );

  return (
    <section id="paths" aria-label="Choose the right path" className="pn-section">
      <header className="pn-dim-intro">
        <p className="pn-eyebrow uppercase">{t('partners.paths.eyebrow')}</p>
        <h2 className="pn-h2b uppercase">{t('partners.paths.title')}</h2>
      </header>
      <div className="pn-paths">
        {ROUTE_IDS.map((id, i) => {
          const items = t(`partners.routes.${id}.items`, { returnObjects: true }) as string[];
          return (
            <div
              key={id}
              id={`path-${id}`}
              className="pn-path"
              data-active={activePath === id ? 'true' : 'false'}
            >
              <div
                className="pn-phead"
                role="button"
                tabIndex={0}
                onClick={() => onSelectPath(id)}
                onKeyDown={handleHeadKey(id)}
              >
                <span className="pn-hudlbl uppercase">
                  {`0${i + 1} · ${t(`partners.routes.${id}.panelTitle`)}`}
                </span>
                <span className={`pn-st ${statusClass(t(`partners.routes.${id}.status`))}`}>
                  {t(`partners.routes.${id}.status`)}
                </span>
              </div>
              <p className="pn-q">{t(`partners.routes.${id}.question`)}</p>
              <ul>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="pn-pcta">
                <button
                  type="button"
                  className="pn-pill pn-pill-line uppercase"
                  onClick={() => goDest(id)}
                >
                  {t(`partners.routes.${id}.cta`)}
                </button>
                {id === 'integration' ? (
                  /* TODO(later): /partners/integrations */
                  null
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
