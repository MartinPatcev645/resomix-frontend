import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  REFS,
  blocksOf,
  blocksRowOf,
  energyD,
  pulsesOf,
  ridgeD,
  rngFor,
} from './sdEngine.ts';

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

function GrooveViz() {
  const ref = REFS.int;
  const pulses = useMemo(
    () => pulsesOf(`${ref.t}big`, ref.dens, 16, 150, 724, 116, 64),
    [ref.t, ref.dens],
  );
  const densityRects = useMemo(() => {
    const r = rngFor('dens');
    return Array.from({ length: 16 }, (_, j) => {
      const dv = 0.4 + 0.6 * r();
      return { x: 16 + j * 45.25, y: 182 + 16 * (1 - dv), w: 45.25 - 2, h: 16 * dv };
    });
  }, []);

  return (
    <svg viewBox="0 0 760 220" role="img" aria-label="Groove field: a beat grid with percussion pulses of varying height; accented hits are marked in orange, and a density band below shows how busy each bar is. Sample data.">
      {Array.from({ length: 33 }, (_, i) => (
        <line
          key={i}
          x1={16 + i * 22.6}
          y1={20}
          x2={16 + i * 22.6}
          y2={150}
          stroke={`rgba(255,255,255,${i % 4 === 0 ? 0.14 : 0.06})`}
        />
      ))}
      {pulses.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.width}
          height={p.height}
          fill={p.acc ? '#EE4A26' : 'rgba(255,255,255,.6)'}
          opacity={p.acc ? 0.95 : 0.65}
        />
      ))}
      <SvgText x={16} y={172}>BAR 17–33 · 124 BPM</SvgText>
      <rect x={16} y={182} width={724} height={16} fill="none" stroke="rgba(255,255,255,.14)" />
      {densityRects.map((d, i) => (
        <rect key={i} x={d.x} y={d.y} width={d.w} height={d.h} fill="rgba(255,255,255,.22)" />
      ))}
      <SvgText x={740} y={172} anchor="end">ACCENTS IN ORANGE</SvgText>
      <SvgText x={740} y={196} anchor="end">DENSITY</SvgText>
    </svg>
  );
}

function EnergyViz() {
  const ref = REFS.int;
  const p2 = 0.55 + ref.e * 0.3;
  const p4 = Math.min(0.95, 0.5 + ref.e * 0.35);
  const buildX = 16 + 724 * 0.28;
  const buildY = 24 + 160 * (1 - p2);
  const peakX = 16 + 724 * 0.76;
  const peakY = 24 + 160 * (1 - p4);
  const px = 16 + 724 * 0.62;
  const py = 24 + 160 * (1 - 0.62);

  return (
    <svg viewBox="0 0 760 220" role="img" aria-label="Energy journey: a contour line rising through a build to a peak, easing through a breakdown, and resolving. From the current position, three dashed directions are marked: maintain, raise and ease. Sample data.">
      {[1, 2, 3].map((i) => (
        <line key={i} x1={16} y1={20 + i * 45} x2={740} y2={20 + i * 45} stroke="rgba(255,255,255,.06)" />
      ))}
      <path
        d={energyD(ref, 16, 24, 724, 160)}
        stroke="#fff"
        strokeWidth={2}
        fill="none"
        opacity={0.9}
        className="sd-draw"
      />
      <circle cx={buildX} cy={buildY} r={4} fill="#EE4A26" />
      <SvgText x={buildX} y={buildY - 12} className="sd-slbl" anchor="middle">BUILD</SvgText>
      <circle cx={peakX} cy={peakY} r={4} fill="#EE4A26" />
      <SvgText x={peakX} y={peakY - 12} className="sd-slbl" anchor="middle">PEAK</SvgText>
      <SvgText x={16 + 724 * 0.5} y={24 + 160 * (1 - 0.34) + 22} className="sd-slbl" anchor="middle">RELEASE</SvgText>
      <line x1={px} y1={24} x2={px} y2={200} stroke="rgba(255,255,255,.2)" strokeDasharray="1 5" />
      <path d={`M${px} ${py} L${px + 120} ${py}`} stroke="rgba(255,255,255,.5)" strokeDasharray="4 5" fill="none" />
      <SvgText x={px + 128} y={py + 4}>MAINTAIN</SvgText>
      <path
        d={`M${px} ${py} C ${px + 60} ${py - 8} ${px + 80} ${py - 38} ${px + 120} ${py - 44}`}
        stroke="#EE4A26"
        strokeDasharray="4 5"
        fill="none"
      />
      <SvgText x={px + 128} y={py - 42}>RAISE</SvgText>
      <path
        d={`M${px} ${py} C ${px + 60} ${py + 10} ${px + 80} ${py + 40} ${px + 120} ${py + 46}`}
        stroke="rgba(255,255,255,.35)"
        strokeDasharray="4 5"
        fill="none"
      />
      <SvgText x={px + 128} y={py + 52}>EASE</SvgText>
    </svg>
  );
}

function TimbreViz() {
  const layers: [string, number, number][] = [
    ['AIR', 0.28, 0.2],
    ['PRESENCE', 0.5, 0.35],
    ['BODY', 0.75, 0.55],
    ['SUB', 1, 0.8],
  ];

  return (
    <svg viewBox="0 0 760 220" role="img" aria-label="Timbre field: layered spectral ridges from dark to bright; the reference's texture zone is banded in orange between the layers. Sample data.">
      {layers.map(([label, scale, strokeOp], li) => (
        <g key={label}>
          <path
            d={ridgeD(`timbre${li}`, li, scale, 16, 196, 724, 150 * scale, true)}
            fill={`rgba(255,255,255,${0.03 + li * 0.012})`}
            stroke={`rgba(255,255,255,${strokeOp})`}
            strokeWidth={1}
          />
          <SvgText x={20} y={196 - 150 * scale + 16}>{label}</SvgText>
        </g>
      ))}
      <rect
        x={16}
        y={88}
        width={724}
        height={34}
        fill="rgba(238,74,38,.10)"
        stroke="#EE4A26"
        strokeWidth={1}
        strokeDasharray="2 4"
      />
      <SvgText x={740} y={108} className="sd-slbl" anchor="end">RELATED-TEXTURE ZONE</SvgText>
      <SvgText x={16} y={214}>DARK</SvgText>
      <SvgText x={740} y={214} anchor="end">BRIGHT</SvgText>
    </svg>
  );
}

function StructureViz() {
  const ref = REFS.int;
  const refBlocks = blocksRowOf(ref.t, 16, 40, 724, 44, 'rgba(255,255,255,.55)', true);
  const candBlocks = blocksRowOf('PALE ORBIT', 16, 134, 724, 44, 'rgba(238,74,38,.85)', true);
  const refParts = blocksOf(ref.t);
  const candParts = blocksOf('PALE ORBIT');

  return (
    <svg viewBox="0 0 760 220" role="img" aria-label="Structure alignment: the reference track's phrase blocks (intro, build, drop, break, outro) on one row, a candidate's blocks on a second row, with alignment ticks between them and the drop highlighted in orange. Sample data.">
      <SvgText x={16} y={30} className="sd-slbl">REFERENCE · NIGHT CIRCUIT</SvgText>
      {refBlocks.map((b) => (
        <g key={`ref-${b.label}-${b.x}`}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill="none"
            stroke={b.hot ? '#EE4A26' : 'rgba(255,255,255,.55)'}
            strokeWidth={b.hot ? 1.4 : 1}
            opacity={b.hot ? 0.95 : 0.8}
          />
          {b.showLabel && (
            <SvgText x={b.x + 5} y={b.y + b.h - 7}>{b.label}</SvgText>
          )}
        </g>
      ))}
      <SvgText x={16} y={124} className="sd-slbl">CANDIDATE · PALE ORBIT</SvgText>
      {candBlocks.map((b) => (
        <g key={`cand-${b.label}-${b.x}`}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill="none"
            stroke={b.hot ? '#EE4A26' : 'rgba(238,74,38,.85)'}
            strokeWidth={b.hot ? 1.4 : 1}
            opacity={b.hot ? 0.95 : 0.8}
          />
          {b.showLabel && (
            <SvgText x={b.x + 5} y={b.y + b.h - 7}>{b.label}</SvgText>
          )}
        </g>
      ))}
      {refParts.map((b, bi) => {
        const cb = candParts[bi];
        if (!cb) return null;
        const x1 = 16 + (b.x + b.w / 2) * 724;
        const x2 = 16 + (cb.x + cb.w / 2) * 724;
        return (
          <line
            key={bi}
            x1={x1}
            y1={84}
            x2={x2}
            y2={134}
            stroke="rgba(255,255,255,.22)"
            strokeDasharray="1 4"
          />
        );
      })}
      <SvgText x={16} y={206}>ALIGNMENT TICKS · WHERE KEY MOMENTS LINE UP</SvgText>
    </svg>
  );
}

const BANDS = [
  {
    key: 'd1',
    num: '01',
    flip: false,
    label: 'Groove',
    hud: 'GROOVE · PERCUSSION FIELD',
    footL: 'accents in orange · density band below',
    footR: 'night circuit',
    Viz: GrooveViz,
  },
  {
    key: 'd2',
    num: '02',
    flip: true,
    label: 'Energy',
    hud: 'ENERGY · JOURNEY',
    footL: 'build · peak · release markers',
    footR: 'dashed: the three energy directions',
    Viz: EnergyViz,
  },
  {
    key: 'd3',
    num: '03',
    flip: false,
    label: 'Timbre',
    hud: 'TIMBRE · SPECTRAL FIELD',
    footL: 'dark ↔ bright · dense ↔ open',
    footR: 'orange band: related-texture zone',
    Viz: TimbreViz,
  },
  {
    key: 'd4',
    num: '04',
    flip: true,
    label: 'Structure',
    hud: 'STRUCTURE · PHRASE ALIGNMENT',
    footL: 'reference above · candidate below · alignment ticks',
    footR: 'drop highlighted',
    Viz: StructureViz,
  },
] as const;

export function SdDimensionBands() {
  const { t } = useTranslation('common');

  return (
    <section id="sd-dimensions" className="sd-section" aria-label="What PYXIS-1 listens for">
      <header className="sd-dim-intro">
        <p className="sd-eyebrow uppercase">{t('sonicDiscovery.dims.eyebrow')}</p>
        <h2 className="sd-h2b uppercase">{t('sonicDiscovery.dims.title')}</h2>
        <p className="sd-lead">{t('sonicDiscovery.dims.lead')}</p>
      </header>

      {BANDS.map((band) => {
        const Viz = band.Viz;
        return (
          <article
            key={band.key}
            className={`sd-dimband${band.flip ? ' sd-flip' : ''}`}
            aria-label={band.label}
          >
            <div className="sd-dimmeta">
              <div className="sd-dimnum-row">
                <span className="sd-outnum" aria-hidden="true">
                  {band.num}
                </span>
                <h3 className="sd-h3b uppercase">{t(`sonicDiscovery.dims.${band.key}`)}</h3>
              </div>
              <p className="sd-q">{t(`sonicDiscovery.dims.${band.key}q`)}</p>
              <p className="sd-body">{t(`sonicDiscovery.dims.${band.key}body`)}</p>
              <span className="sd-steer">
                <b>steers:</b> {t(`sonicDiscovery.dims.${band.key}steer`)}
              </span>
            </div>
            <div className="sd-dimviz">
              <span className="sd-hudlbl uppercase">{band.hud}</span>
              <Viz />
              <div className="sd-viz-foot">
                <span className="sd-lbl-dim">{band.footL}</span>
                <span className="sd-lbl-dim">{band.footR}</span>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
