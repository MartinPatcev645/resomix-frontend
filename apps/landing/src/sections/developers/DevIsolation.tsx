import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { drawCls, rngFor } from './devEngine.ts';
import { SvgText } from './devSvgHelpers.tsx';

function IsoDesktop() {
  const partners: [string, number, string][] = [
    ['A', 60, 'rmx_live_…a'],
    ['B', 640, 'rmx_live_…b'],
  ];

  return (
    <svg
      viewBox="0 0 1160 360"
      role="img"
      aria-label="Isolation diagram: two dashed partner boundaries sit side by side, each containing its own private similarity index. An uploaded reference enters Partner A's boundary and ranked results return only from Partner A's index. No line crosses between partners, and the space between them is empty, as there is no shared pool. Fictional diagram."
      className="dev-isosvg"
    >
      {partners.map(([label, x, key]) => {
        const r = rngFor(`iso${label}`);
        const dots = Array.from({ length: 46 }, (_, i) => {
          const cx = x + 40 + r() * 380;
          const cy = 96 + r() * 190;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={2.2}
              fill={`rgba(255,255,255,${r() < 0.4 ? 0.14 : 0.3})`}
            />
          );
        });
        return (
          <g key={label}>
            <rect
              x={x}
              y={40}
              width={460}
              height={280}
              fill="rgba(255,255,255,.012)"
              stroke="rgba(255,255,255,.3)"
              strokeDasharray="5 6"
            />
            <SvgText x={x + 16} y={64} className="dev-slbl">
              {`PARTNER ${label} · PRIVATE INDEX`}
            </SvgText>
            <SvgText x={x + 444} y={64} className="dev-smicro" anchor="end">
              {key}
            </SvgText>
            {dots}
          </g>
        );
      })}
      <SvgText x={18} y={120} className="dev-slbl">
        UPLOADED
      </SvgText>
      <SvgText x={18} y={136} className="dev-slbl">
        REFERENCE
      </SvgText>
      <path d="M30 148 C 30 190 40 190 62 190" stroke="#EE4A26" strokeWidth={1.5} fill="none" className={drawCls()} />
      <circle cx={230} cy={190} r={5} fill="#EE4A26" />
      <path d="M66 190 H 224" stroke="#EE4A26" strokeDasharray="2 4" fill="none" className={drawCls()} />
      {[
        [300, 140],
        [360, 220],
        [420, 170],
      ].map(([cx, cy], i) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={4} fill="rgba(238,74,38,.85)" />
          <path
            d={`M234 190 C 260 190 ${Number(cx) - 30} ${cy} ${Number(cx) - 6} ${cy}`}
            stroke="rgba(238,74,38,.5)"
            fill="none"
            className={drawCls(`dev-d${i + 2}`)}
          />
        </g>
      ))}
      <SvgText x={290} y={344} className="dev-slbl-dim">
        results return only from partner a
      </SvgText>
      <line x1={580} y1={50} x2={580} y2={310} stroke="rgba(255,255,255,.12)" strokeDasharray="1 6" />
      <SvgText x={580} y={190} className="dev-slbl" anchor="middle">
        NO SHARED POOL
      </SvgText>
      <SvgText x={580} y={208} className="dev-slbl-dim" anchor="middle">
        no cross-partner path
      </SvgText>
      <circle cx={840} cy={190} r={5} fill="rgba(255,255,255,.6)" />
      <path d="M846 190 C 890 170 920 210 950 196" stroke="rgba(255,255,255,.3)" strokeDasharray="2 4" fill="none" />
      <SvgText x={868} y={344} className="dev-slbl-dim">
        partner b: identical api · sealed separately
      </SvgText>
    </svg>
  );
}

function IsoMobile() {
  const r = rngFor('isom');
  const dots = Array.from({ length: 30 }, (_, i) => (
    <circle
      key={i}
      cx={40 + r() * 280}
      cy={90 + r() * 140}
      r={2}
      fill={`rgba(255,255,255,${r() < 0.4 ? 0.14 : 0.3})`}
    />
  ));

  return (
    <svg
      viewBox="0 0 360 300"
      role="img"
      aria-label="Simplified isolation diagram: one dashed partner boundary containing a private index; an uploaded reference enters and ranked results return from the same boundary. No shared catalogue, no cross-partner results. Fictional diagram."
      className="dev-iso-m"
    >
      <rect
        x={14}
        y={40}
        width={332}
        height={220}
        fill="rgba(255,255,255,.012)"
        stroke="rgba(255,255,255,.3)"
        strokeDasharray="5 6"
      />
      <SvgText x={26} y={62} className="dev-slbl">
        YOUR PRIVATE INDEX
      </SvgText>
      {dots}
      <SvgText x={14} y={20} className="dev-slbl">
        UPLOADED REFERENCE
      </SvgText>
      <path d="M40 26 C 40 60 60 80 90 110" stroke="#EE4A26" strokeWidth={1.5} fill="none" />
      <circle cx={96} cy={114} r={5} fill="#EE4A26" />
      {[
        [180, 120],
        [240, 180],
        [140, 200],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={4} fill="rgba(238,74,38,.85)" />
          <path
            d={`M102 116 C 130 116 ${Number(cx) - 24} ${cy} ${Number(cx) - 6} ${cy}`}
            stroke="rgba(238,74,38,.5)"
            fill="none"
          />
        </g>
      ))}
      <SvgText x={180} y={286} className="dev-slbl-dim" anchor="middle">
        results return from this boundary only
      </SvgText>
    </svg>
  );
}

export function DevIsolation() {
  const { t } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);

  const points = t('developers.isolation.points', { returnObjects: true }) as { bold: string; body: string }[];

  return (
    <section id="dev-isolation" className="dev-section" aria-label="Partner catalogue isolation">
      <header className="dev-dim-intro">
        <p className="dev-eyebrow uppercase">{t('developers.isolation.eyebrow')}</p>
        <h2 className="dev-h2b uppercase">{t('developers.isolation.title')}</h2>
      </header>
      <div className="dev-iso-wrap">
        <span className="dev-hudlbl dev-hudtop-l uppercase">{t('developers.isolation.diagramLabel')}</span>
        <IsoDesktop />
        <div className="dev-iso-mobile">
          <IsoMobile />
          <p className="dev-interp dev-iso-contrast">
            <b>{t('developers.isolation.mobileContrast')}</b>
          </p>
          <button
            type="button"
            className="dev-ghostbtn dev-m-disclose uppercase"
            aria-expanded={expanded}
            aria-controls="dev-iso-wrap"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? t('developers.isolation.disclosureOpen')
              : t('developers.isolation.disclosureClosed')}
          </button>
          <div className={`dev-expandable${expanded ? ' dev-open' : ''}`} id="dev-iso-wrap">
            <p className="dev-body dev-iso-detail">{t('developers.isolation.disclosureBody')}</p>
          </div>
        </div>
        <div className="dev-iso-points">
          {points.map((p) => (
            <p key={p.bold}>
              <b>{p.bold}</b> {p.body}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
