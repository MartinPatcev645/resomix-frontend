import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AUTH_CODE, ENVELOPE_LINES } from './devEngine.ts';
import { DevCodeBlock } from './DevCodeBlock.tsx';
import { SvgText } from './devSvgHelpers.tsx';
import { DevCopyButton } from './DevCopyButton.tsx';

function QuotaPulseSvg() {
  const y = 40;
  return (
    <svg
      viewBox="0 0 520 95"
      role="img"
      aria-label="Quota pulse: a steady series of request ticks, one marked as HTTP 429 with a Retry-After pause below it, then requests resuming with exponential backoff. No numeric limits are shown."
      className="dev-pulsesvg"
    >
      <line x1={10} y1={y} x2={510} y2={y} stroke="rgba(255,255,255,.15)" />
      {Array.from({ length: 10 }, (_, i) => (
        <line
          key={i}
          x1={20 + i * 22}
          y1={y - 10}
          x2={20 + i * 22}
          y2={y + 10}
          stroke="rgba(255,255,255,.45)"
          strokeWidth={1.5}
        />
      ))}
      <line x1={242} y1={y - 14} x2={242} y2={y + 14} stroke="#EE4A26" strokeWidth={2.5} />
      <SvgText x={242} y={y - 22} className="dev-sval dev-slbl-hot" anchor="middle">
        429
      </SvgText>
      <path
        d={`M250 ${y + 16} C 262 ${y + 26} 300 ${y + 26} 314 ${y + 16}`}
        stroke="rgba(238,74,38,.5)"
        strokeDasharray="2 3"
        fill="none"
      />
      <SvgText x={282} y={y + 40} className="dev-smicro" anchor="middle">
        retry-after
      </SvgText>
      {[326, 364, 410, 462].map((x, i) => (
        <line
          key={x}
          x1={x}
          y1={y - 10}
          x2={x}
          y2={y + 10}
          stroke={`rgba(255,255,255,${0.45 - i * 0.06})`}
          strokeWidth={1.5}
        />
      ))}
      <SvgText x={394} y={y - 20} className="dev-smicro" anchor="middle">
        exponential backoff
      </SvgText>
    </svg>
  );
}

type DevIntegrationAccessProps = {
  onCopy: (label: string) => void;
};

export function DevIntegrationAccess({ onCopy }: DevIntegrationAccessProps) {
  const { t } = useTranslation('common');
  const [laterOpen, setLaterOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  const liveRows = t('developers.integration.liveRows', { returnObjects: true }) as {
    title: string;
    status: string;
    statusClass: string;
    body: string;
    required?: boolean;
  }[];

  const plannedRows = t('developers.integration.plannedRows', { returnObjects: true }) as {
    title: string;
    status: string;
    body: string;
  }[];

  return (
    <section id="dev-integration" className="dev-section" aria-label="Choose the right integration">
      <header className="dev-dim-intro">
        <p className="dev-eyebrow uppercase">{t('developers.integration.eyebrow')}</p>
        <h2 className="dev-h2b uppercase">{t('developers.integration.title')}</h2>
      </header>

      <div className="dev-imx">
        {liveRows.map((row) => (
          <div key={row.title} className="dev-imx-row">
            <span className="dev-imx-t uppercase">{row.title}</span>
            <span className={`dev-st dev-st-${row.statusClass} uppercase`}>{row.status}</span>
            <p>
              {row.body}
              {row.required ? (
                <>
                  {' '}
                  <b className="dev-required uppercase">{t('developers.integration.requiredNote')}</b>
                </>
              ) : null}
            </p>
          </div>
        ))}
        <button
          type="button"
          className="dev-ghostbtn dev-m-disclose dev-imx-later uppercase"
          aria-expanded={laterOpen}
          aria-controls="dev-later-rows"
          onClick={() => setLaterOpen((v) => !v)}
        >
          {laterOpen ? t('developers.integration.laterOpen') : t('developers.integration.laterClosed')}
        </button>
        <div id="dev-later-rows" className={`dev-later-rows${laterOpen ? ' dev-open' : ''}`}>
          {plannedRows.map((row) => (
            <div key={row.title} className="dev-imx-row dev-plan">
              <span className="dev-imx-t uppercase">{row.title}</span>
              <span className="dev-st dev-st-plan uppercase">{row.status}</span>
              <p>{row.body}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="dev-ghostbtn dev-m-disclose dev-access-toggle uppercase"
        aria-expanded={accessOpen}
        aria-controls="dev-access-wrap"
        onClick={() => setAccessOpen((v) => !v)}
      >
        {accessOpen ? t('developers.integration.accessOpen') : t('developers.integration.accessClosed')}
      </button>

      <div className={`dev-access${accessOpen ? ' dev-open' : ''}`} id="dev-access-wrap">
        <div className="dev-hud dev-hudpad">
          <span className="dev-hudlbl dev-hudtop-l uppercase">{t('developers.integration.accessLabel')}</span>
          <div className="dev-codelbl dev-access-gap">
            <span className="dev-lbl uppercase">{t('developers.integration.authLabel')}</span>
            <span className="dev-lbl-dim">{t('developers.integration.authNote')}</span>
          </div>
          <div className="dev-code dev-jsonwrap">
            <DevCopyButton getText={() => AUTH_CODE} onCopy={onCopy} />
            <code id="dev-auth-code">{AUTH_CODE}</code>
          </div>
          <div className="dev-codelbl dev-access-gap-lg">
            <span className="dev-lbl uppercase">{t('developers.integration.envelopeLabel')}</span>
            <span className="dev-lbl-dim">{t('developers.integration.envelopeNote')}</span>
          </div>
          <div className="dev-code">
            <DevCodeBlock lines={ENVELOPE_LINES} />
          </div>
          <p className="dev-lbl-dim dev-access-scopes">{t('developers.integration.scopesNote')}</p>
        </div>
        <div className="dev-hud dev-hudpad">
          <span className="dev-hudlbl dev-hudtop-l uppercase">{t('developers.integration.modesLabel')}</span>
          <div className="dev-modegate">
            {(t('developers.integration.modes', { returnObjects: true }) as { title: string; body: string; status: string; statusClass: string }[]).map(
              (mode) => (
                <div key={mode.title}>
                  <span className="dev-mode-t uppercase">{mode.title}</span>
                  <p>{mode.body}</p>
                  <span className={`dev-st dev-st-${mode.statusClass} dev-mode-st uppercase`}>{mode.status}</span>
                </div>
              ),
            )}
          </div>
          <div className="dev-codelbl dev-access-gap-lg">
            <span className="dev-lbl uppercase">{t('developers.integration.limitsLabel')}</span>
            <span className="dev-lbl-dim">{t('developers.integration.limitsNote')}</span>
          </div>
          <QuotaPulseSvg />
          <p className="dev-lbl-dim dev-limits-foot">{t('developers.integration.limitsFoot')}</p>
        </div>
      </div>
    </section>
  );
}
