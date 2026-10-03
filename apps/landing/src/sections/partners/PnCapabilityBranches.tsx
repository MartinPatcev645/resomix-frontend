import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CAPABILITY_BRANCHES } from './pnData.ts';

function SvgText({
  x,
  y,
  className,
  anchor,
  children,
}: {
  x: number;
  y: number;
  className?: string;
  anchor?: 'middle' | 'end';
  children: React.ReactNode;
}) {
  return (
    <text x={x} y={y} className={className} textAnchor={anchor}>
      {children}
    </text>
  );
}

export function PnCapabilityBranches() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section id="capabilities" aria-label="What Resomix brings" className="pn-section">
      <header className="pn-dim-intro">
        <p className="pn-eyebrow uppercase">{t('partners.capabilities.eyebrow')}</p>
        <h2 className="pn-h2b uppercase">{t('partners.capabilities.title')}</h2>
      </header>
      <figure className="pn-railsfig" role="img" aria-label={t('partners.capabilities.figureAlt')}>
        <svg viewBox="0 0 1160 300" aria-hidden="true" focusable="false">
          <SvgText x={14} y={138} className="pn-slbl pn-slbl-hot">
            PYXIS-1
          </SvgText>
          <SvgText x={14} y={156} className="pn-smicro">
            {t('partners.capabilities.engineNote')}
          </SvgText>
          <line
            x1={14}
            y1={170}
            x2={150}
            y2={170}
            stroke="#EE4A26"
            strokeWidth={1.6}
            className="pn-draw"
          />
          <circle cx={160} cy={170} r={6} fill="#101010" stroke="#EE4A26" strokeWidth={1.4} />
          {CAPABILITY_BRANCHES.map((branch, i) => (
            <g key={branch.id}>
              <path
                d={`M168 170 C 240 170 240 ${branch.y} 310 ${branch.y}`}
                stroke="rgba(238,74,38,.45)"
                strokeWidth={1.2}
                fill="none"
                className={`pn-draw pn-d${i + 1}`}
              />
              <line
                x1={310}
                y1={branch.y}
                x2={1060}
                y2={branch.y}
                stroke="rgba(255,255,255,.14)"
                className={`pn-draw pn-d${i + 1}`}
              />
              <SvgText x={318} y={branch.y - 10} className="pn-slbl">
                {branch.t}
              </SvgText>
              <SvgText x={318} y={branch.y + 16} className="pn-smicro">
                {branch.items[0]}
              </SvgText>
              <SvgText x={318} y={branch.y + 30} className="pn-smicro">
                {branch.items[1]}
              </SvgText>
              <circle cx={1070} cy={branch.y} r={4} fill="#101010" stroke="#fff" strokeWidth={1.2} />
              <SvgText x={1082} y={branch.y + 4} className="pn-smicro">
                {branch.dest}
              </SvgText>
            </g>
          ))}
        </svg>
      </figure>
      <div className="pn-rails-open">
        {CAPABILITY_BRANCHES.map((branch) => (
          <div key={branch.id} className="pn-rail-open">
            <span className="pn-hudlbl uppercase">{branch.t}</span>
            <ul>
              {branch.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {/* MB-29. List only: the same `items` strings are drawn as SVG <text> above, where
                  an anchor would be invalid, so the link lives in its own entry. */}
              {branch.blog ? (
                <li>
                  <a className="rx-copylink" target="_blank" rel="noopener" href={branch.blog.href}>{branch.blog.label}</a>
                </li>
              ) : null}
            </ul>
            <button
              type="button"
              className="pn-bracket"
              onClick={() => navigate(branch.dest)}
            >
              {t(`partners.capabilities.links.${branch.id}`)}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
