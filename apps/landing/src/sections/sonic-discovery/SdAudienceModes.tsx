import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { pulsesOf, ridgeD } from './sdEngine.ts';

export type AudienceMode = 'dj' | 'prod' | 'sup';

type SdAudienceModesProps = {
  mode: AudienceMode;
  onModeChange: (m: AudienceMode) => void;
  onScrollToConsole: () => void;
};

type SvgTextProps = {
  x: number;
  y: number;
  className?: string;
  anchor?: 'start' | 'middle' | 'end';
  children: string;
};

function SvgText({ x, y, className = 'sd-slbl-dim', anchor, children }: SvgTextProps) {
  return (
    <text x={x} y={y} className={className} textAnchor={anchor}>
      {children}
    </text>
  );
}

function DjAudViz() {
  return (
    <svg viewBox="0 0 720 320" role="img" aria-label="DJ view: a set energy path across now, next and later, with the next transition offering an orange lift alternative and a grey reset alternative. Sample data.">
      {[
        ['NOW', 120],
        ['NEXT', 360],
        ['LATER', 600],
      ].map(([label, x]) => (
        <g key={String(label)}>
          <line x1={Number(x)} y1={40} x2={Number(x)} y2={270} stroke="rgba(255,255,255,.14)" />
          <SvgText x={Number(x)} y={292} className="sd-slbl" anchor="middle">
            {String(label)}
          </SvgText>
        </g>
      ))}
      <path
        d="M30 220 C 120 208 200 160 300 150 S 470 96 540 104 S 660 160 690 172"
        stroke="#fff"
        strokeWidth={1.8}
        fill="none"
        opacity={0.85}
      />
      <circle cx={360} cy={132} r={5} fill="#EE4A26" />
      <SvgText x={360} y={116} className="sd-slbl" anchor="middle">
        TRANSITION POINT
      </SvgText>
      <path
        d="M360 132 C 430 100 470 84 530 76"
        stroke="#EE4A26"
        strokeDasharray="4 5"
        fill="none"
        strokeWidth={1.4}
      />
      <SvgText x={540} y={74}>ALT: LIFT</SvgText>
      <path
        d="M360 132 C 430 168 470 190 530 198"
        stroke="rgba(255,255,255,.45)"
        strokeDasharray="4 5"
        fill="none"
      />
      <SvgText x={540} y={206}>ALT: RESET</SvgText>
      <SvgText x={30} y={262}>SET ENERGY PATH — SAMPLE SESSION</SvgText>
    </svg>
  );
}

function ProdAudViz() {
  const panels = useMemo(
    () =>
      [
        ['TEXTURE STUDY', 26, 'rgba(255,255,255,.4)', 0],
        ['REFERENCE THEME', 266, '#EE4A26', 1],
        ['GROOVE VARIANT', 506, 'rgba(255,255,255,.4)', 2],
      ] as const,
    [],
  );

  return (
    <svg viewBox="0 0 720 320" role="img" aria-label="Producer view: a reference board of three panels comparing texture, the reference theme and a groove variant, connected by dotted relationship lines. Sample data.">
      {panels.map(([label, x, stroke, bi]) => {
        const dens = 0.6 + bi * 0.1;
        const bright = 0.4 + bi * 0.15;
        const pulses = pulsesOf(`board${bi}`, dens, x + 14, 214, 162, 18, 20);
        const isRef = stroke === '#EE4A26';

        return (
          <g key={label}>
            <rect
              x={x}
              y={60}
              width={190}
              height={170}
              fill="none"
              stroke={stroke}
              strokeWidth={isRef ? 1.4 : 1}
            />
            <SvgText x={x + 8} y={52} className="sd-slbl">
              {label}
            </SvgText>
            <path
              d={ridgeD(`board${bi}`, bi, bright, x + 14, 190, 162, 70, false)}
              stroke={isRef ? '#EE4A26' : 'rgba(255,255,255,.6)'}
              strokeWidth={1.2}
              fill="none"
            />
            {pulses.map((p, i) => (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.height}
                fill={p.acc ? (isRef ? '#EE4A26' : 'rgba(255,255,255,.7)') : 'rgba(255,255,255,.4)'}
                opacity={p.acc ? 0.95 : 0.65}
              />
            ))}
          </g>
        );
      })}
      <path d="M216 145 H 266 M456 145 H 506" stroke="rgba(255,255,255,.3)" strokeDasharray="2 4" />
      <SvgText x={26} y={292}>RELATED THEMES — DIRECTION, NOT DUPLICATION</SvgText>
    </svg>
  );
}

function SupAudViz() {
  const groups = [
    ['DIRECTION A · 4 TRACKS', 70, '#EE4A26'],
    ['DIRECTION B · 3 TRACKS', 150, 'rgba(255,255,255,.6)'],
    ['WILDCARDS · 2 TRACKS', 230, 'rgba(255,255,255,.4)'],
  ] as const;

  return (
    <svg viewBox="0 0 720 320" role="img" aria-label="Supervisor view: a written brief leads to a reference track, which branches into three grouped shortlist directions with track counts. Sample data.">
      <rect x={26} y={70} width={200} height={130} fill="none" stroke="rgba(255,255,255,.4)" />
      <SvgText x={38} y={94} className="sd-slbl">BRIEF</SvgText>
      <SvgText x={38} y={120}>&quot;late-night, warm,</SvgText>
      <SvgText x={38} y={138}>not obvious&quot;</SvgText>
      <path d="M226 135 H 286" stroke="rgba(255,255,255,.4)" />
      <rect x={286} y={110} width={160} height={50} fill="none" stroke="#EE4A26" strokeWidth={1.4} />
      <SvgText x={300} y={140} className="sd-slbl">REFERENCE.WAV</SvgText>
      {groups.map(([label, y, stroke]) => (
        <g key={label}>
          <path
            d={`M446 135 C 500 135 500 ${y + 14} 540 ${y + 14}`}
            stroke="rgba(255,255,255,.35)"
            fill="none"
          />
          <rect x={540} y={y} width={150} height={30} fill="none" stroke={stroke} />
          <SvgText x={548} y={y + 19}>{label}</SvgText>
        </g>
      ))}
      <SvgText x={26} y={292}>BRIEF → REFERENCE → GROUPED SHORTLIST</SvgText>
    </svg>
  );
}

const MODES: { id: AudienceMode; label: string }[] = [
  { id: 'dj', label: 'DJs' },
  { id: 'prod', label: 'Producers' },
  { id: 'sup', label: 'Supervisors & Curators' },
];

const MODE_CONTENT: Record<
  AudienceMode,
  { headKey: string; copyKey: string; attrKeys: string[]; ctaKey: string }
> = {
  dj: {
    headKey: 'djHead',
    copyKey: 'djCopy',
    attrKeys: ['djA1', 'djA2', 'djA3', 'djA4'],
    ctaKey: 'djCta',
  },
  prod: {
    headKey: 'prodHead',
    copyKey: 'prodCopy',
    attrKeys: ['prodA1', 'prodA2', 'prodA3', 'prodA4'],
    ctaKey: 'prodCta',
  },
  sup: {
    headKey: 'supHead',
    copyKey: 'supCopy',
    attrKeys: ['supA1', 'supA2', 'supA3', 'supA4'],
    ctaKey: 'supCta',
  },
};

const VIZ_CONFIG = [
  {
    id: 'audviz-dj',
    mode: 'dj' as const,
    hud: 'SET FLOW · TRANSITION ALTERNATIVES',
    Viz: DjAudViz,
  },
  {
    id: 'audviz-prod',
    mode: 'prod' as const,
    hud: 'REFERENCE BOARD · RELATED THEMES',
    Viz: ProdAudViz,
  },
  {
    id: 'audviz-sup',
    mode: 'sup' as const,
    hud: 'BRIEF → REFERENCE → GROUPED SHORTLIST',
    Viz: SupAudViz,
  },
] as const;

export function SdAudienceModes({ mode, onModeChange, onScrollToConsole }: SdAudienceModesProps) {
  const { t } = useTranslation('common');
  const content = MODE_CONTENT[mode];

  return (
    <section id="sd-audiences" className="sd-section" aria-label="Professional use cases">
      <header className="sd-dim-intro">
        <p className="sd-eyebrow uppercase">{t('sonicDiscovery.aud.eyebrow')}</p>
        <h2 className="sd-h2b uppercase">{t('sonicDiscovery.aud.title')}</h2>
      </header>

      <div className="sd-seg" role="group" aria-label="Professional mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => onModeChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="sd-aud">
        <div>
          <h3 className="sd-h3b uppercase">{t(`sonicDiscovery.aud.${content.headKey}`)}</h3>
          <p className="sd-body">{t(`sonicDiscovery.aud.${content.copyKey}`)}</p>
          <ul className="sd-audattrs">
            {content.attrKeys.map((key) => (
              <li key={key}>{t(`sonicDiscovery.aud.${key}`)}</li>
            ))}
          </ul>
          <button type="button" className="sd-pill sd-pill-line uppercase" onClick={onScrollToConsole}>
            {t(`sonicDiscovery.aud.${content.ctaKey}`)}
          </button>
        </div>
        <div>
          {VIZ_CONFIG.map(({ id, mode: vizMode, hud, Viz }) => (
            <div key={id} id={id} className={`sd-audviz${mode === vizMode ? ' sd-on' : ''}`}>
              <span className="sd-hudlbl uppercase">{hud}</span>
              <Viz />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
