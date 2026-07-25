import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LENS9, REGIONS, rngFor, type LensKey } from './ciEngine.ts';
import { SvgText } from './ciSvgHelpers.tsx';

const API_DOCS_URL = 'https://api-docs.resomix.com/';
const LENS_KEYS: LensKey[] = ['cm', 'ar', 'sync', 'label', 'api'];

export function CiTeamLenses() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [lens, setLens] = useState<LensKey>('cm');

  const m = LENS9[lens];

  const lensNodes = useMemo(() => {
    const W = 720;
    const H = 300;
    return REGIONS.flatMap((rg) => {
      const on = m.regions.includes(rg.id);
      const r = rngFor(`l9${rg.id}`);
      const n = Math.round(rg.n / 3);
      const dots = [];
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const rad = Math.sqrt(r());
        dots.push({
          regionId: rg.id,
          cx: Number((rg.cx * W + Math.cos(a) * rg.rx * W * 0.9 * rad).toFixed(1)),
          cy: Number((rg.cy * H + Math.sin(a) * rg.ry * H * 0.9 * rad).toFixed(1)),
          on,
        });
      }
      return dots;
    });
  }, [m.regions]);

  const handleCta = () => {
    if (lens === 'api') {
      window.open(API_DOCS_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate('/partners/pilot');
  };

  return (
    <section id="ci-teams" className="ci-section" aria-label="Built for the teams who work the catalogue">
      <header className="ci-dim-intro">
        <p className="ci-eyebrow uppercase">{t('catalogueIntelligence.teams.eyebrow')}</p>
        <h2 className="ci-h2b uppercase">{t('catalogueIntelligence.teams.title')}</h2>
      </header>

      <div className="ci-seg" role="group" aria-label={t('catalogueIntelligence.teams.segLabel')}>
        {LENS_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={lens === key}
            onClick={() => setLens(key)}
          >
            {t(`catalogueIntelligence.teams.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className="ci-lensmode">
        <div>
          <h3 className="ci-h3b uppercase">{m.head}</h3>
          <p className="ci-lead" style={{ fontSize: 'var(--px-18)', marginBottom: 'var(--px-24)' }}>
            {m.q}
          </p>
          <p className="ci-interp">{m.out}</p>
          <button
            type="button"
            className="ci-pill ci-pill-line uppercase mt-[var(--px-20)]"
            onClick={handleCta}
          >
            {m.cta}
          </button>
        </div>
        <div className="ci-lens-viz">
          <span className="ci-hudlbl ci-hudtop-l uppercase">
            {m.head.toUpperCase()} · HIGHLIGHTED CATALOGUE VIEW — SAMPLE
          </span>
          <svg viewBox="0 0 720 300" role="img" aria-label={t('catalogueIntelligence.teams.lensAlt')}>
            {lensNodes.map((dot, i) => (
              <circle
                key={i}
                cx={dot.cx}
                cy={dot.cy}
                r={2}
                fill={dot.on ? 'rgba(238,74,38,.55)' : 'rgba(255,255,255,.12)'}
              />
            ))}
            {REGIONS.map((rg) => {
              const on = m.regions.includes(rg.id);
              return (
                <g key={rg.id}>
                  <ellipse
                    cx={rg.cx * 720}
                    cy={rg.cy * 300}
                    rx={rg.rx * 720 * 0.9 + 10}
                    ry={rg.ry * 300 * 0.9 + 10}
                    fill="none"
                    stroke={on ? '#EE4A26' : 'rgba(255,255,255,.12)'}
                    strokeDasharray={on ? 'none' : '2 5'}
                  />
                  <SvgText
                    x={rg.cx * 720}
                    y={rg.cy * 300 - rg.ry * 300 * 0.9 - 16}
                    className={on ? 'ci-slbl ci-slbl-hot' : 'ci-slbl-dim'}
                    anchor="middle"
                  >
                    {rg.name}
                  </SvgText>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}
