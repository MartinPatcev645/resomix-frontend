import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TRACK,
  SECTIONS,
  centroidAt,
  contourD,
  spectrogramCells,
  timbreEvolutionPaths,
  mfccBars,
  fmt,
} from './tiEngine.ts';
import { SvgText } from './tiSvgHelpers.tsx';
import { drawCls } from './tiEngine.ts';

function renderBoldParts(text: string) {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<b>') && part.endsWith('</b>')) {
      return <b key={i}>{part.slice(3, -4)}</b>;
    }
    return part;
  });
}

export function TiSpectralTerrain() {
  const { t } = useTranslation('common');
  const x0 = 54;
  const w = 1050;
  const y0 = 16;
  const hgt = 260;

  const specCells = useMemo(() => spectrogramCells(x0, w, y0, hgt), [x0, w, y0, hgt]);
  const timbrePaths = useMemo(() => timbreEvolutionPaths(x0, w, 14, 150), [x0, w]);
  const mfcc = useMemo(() => mfccBars(), []);

  const bands = [
    ['AIR', 0],
    ['PRESENCE', 0.3],
    ['BODY', 0.62],
    ['SUB', 0.88],
  ] as const;

  return (
    <section id="ti-spectral" className="ti-section" aria-label="Timbre and spectral character">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.spectral.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.spectral.title')}</h2>
        <p className="ti-lead">{t('trackIntelligence.spectral.lead')}</p>
      </header>

      <div className="ti-bigviz">
        <span className="ti-hudlbl ti-hudtop-l uppercase">{t('trackIntelligence.spectral.panelLabel')}</span>
        <span className="ti-truth ti-hudtop-r uppercase">{t('trackIntelligence.spectral.sampleData')}</span>

        <svg viewBox="0 0 1160 340" role="img" aria-label={t('trackIntelligence.spectral.terrainAlt')}>
          {specCells.map((cell, i) => (
            <rect key={i} x={cell.x} y={cell.y} width={cell.width} height={cell.height} fill={cell.fill} />
          ))}
          {bands.map(([label, frac]) => (
            <SvgText key={label} x={10} y={y0 + frac * hgt + 14}>
              {label}
            </SvgText>
          ))}
          <path
            d={contourD(centroidAt, x0, y0, w, hgt, 0, 1)}
            stroke="#fff"
            strokeWidth={1.8}
            fill="none"
            opacity={0.95}
            className={drawCls()}
          />
          {SECTIONS.map((sec) => (
            <SvgText
              key={sec.n}
              x={x0 + (((sec.t0 + sec.t1) / 2) / TRACK.dur) * w}
              y={y0 + hgt + 26}
              anchor="middle"
            >
              {sec.n}
            </SvgText>
          ))}
        </svg>

        <div className="ti-legend">
          <span>
            <i className="ti-bi" />{t('trackIntelligence.spectral.legendEnergy')}
          </span>
          <span>
            <i className="ti-oi" />{t('trackIntelligence.spectral.legendContour')}
          </span>
          <span className="ti-lbl-dim">{t('trackIntelligence.spectral.legendNote')}</span>
        </div>

        <div className="mt-[var(--px-28)]">
          <span className="ti-lbl uppercase">{t('trackIntelligence.spectral.timbreLabel')}</span>
          <svg
            viewBox="0 0 1160 200"
            role="img"
            aria-label={t('trackIntelligence.spectral.timbreAlt')}
            className="mt-[var(--px-10)] block w-full"
          >
            {timbrePaths.map((band) => (
              <g key={band.name}>
                <path d={band.d} fill={band.fill} stroke="rgba(16,16,16,.6)" strokeWidth={0.75} />
                <SvgText x={10} y={band.labelY}>
                  {band.name}
                </SvgText>
              </g>
            ))}
            <rect
              x={x0 + w * (252 / TRACK.dur)}
              y={14}
              width={w * (74 / TRACK.dur)}
              height={150}
              fill="none"
              stroke="#EE4A26"
              strokeDasharray="2 4"
            />
            <SvgText x={x0 + w * (252 / TRACK.dur) + 6} y={10} className="ti-slbl ti-slbl-hot">
              PRESENCE + AIR WIDEN
            </SvgText>
            <SvgText x={x0} y={174}>
              0:00
            </SvgText>
            <SvgText x={x0 + w} y={174} anchor="end">
              {fmt(TRACK.dur)}
            </SvgText>
          </svg>
        </div>

        <div className="mt-[var(--px-20)]">
          <span className="ti-lbl uppercase">{t('trackIntelligence.spectral.mfccLabel')}</span>
          <svg
            viewBox="0 0 1160 56"
            role="img"
            aria-label={t('trackIntelligence.spectral.mfccAlt')}
            className="mt-[var(--px-10)] block w-full"
          >
            {mfcc.map((bar) => (
              <g key={bar.label}>
                <rect
                  x={bar.x}
                  y={52 - bar.height}
                  width={74}
                  height={bar.height}
                  fill={`rgba(255,255,255,${bar.opacity.toFixed(2)})`}
                />
                <SvgText x={bar.x + 37} y={54} anchor="middle">
                  {bar.label}
                </SvgText>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="ti-split2 mt-[var(--px-32)]">
        <div>
          <p className="ti-interp">{renderBoldParts(t('trackIntelligence.spectral.textureInterp'))}</p>
          <span className="ti-truth inline-block mt-[var(--px-14)] uppercase">
            {t('trackIntelligence.spectral.interpTruth')}
          </span>
        </div>
        <p className="ti-body">{t('trackIntelligence.spectral.body')}</p>
      </div>
    </section>
  );
}
