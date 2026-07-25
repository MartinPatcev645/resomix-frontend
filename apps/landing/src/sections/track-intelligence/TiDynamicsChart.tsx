import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TRACK, SECTIONS, eAt, lAt, contourD, drawCls } from './tiEngine.ts';
import { SvgText } from './tiSvgHelpers.tsx';

function renderBoldParts(text: string) {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<b>') && part.endsWith('</b>')) {
      return <b key={i}>{part.slice(3, -4)}</b>;
    }
    return part;
  });
}

export function TiDynamicsChart() {
  const { t } = useTranslation('common');
  const x0 = 60;
  const w = 1060;
  const y0 = 30;
  const h = 210;

  const bandPath = useMemo(() => {
    let band = '';
    for (let i = 0; i <= 60; i++) {
      const tick = (i / 60) * TRACK.dur;
      const v = (lAt(tick) + 14) / 8;
      band += (i ? ' L' : 'M') + (x0 + (i / 60) * w).toFixed(1) + ' ' + (y0 + h - v * h + 16).toFixed(1);
    }
    for (let i = 60; i >= 0; i--) {
      const tick = (i / 60) * TRACK.dur;
      const v = (lAt(tick) + 14) / 8;
      band += ' L' + (x0 + (i / 60) * w).toFixed(1) + ' ' + (y0 + h - v * h - 16).toFixed(1);
    }
    return band + ' Z';
  }, [x0, w, y0, h]);

  const px = x0 + (289 / TRACK.dur) * w;
  const py = y0 + h - 0.95 * h;

  return (
    <section id="ti-energy" className="ti-section" aria-label="Motion, energy and dynamics">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.energy.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.energy.title')}</h2>
        <p className="ti-lead">{t('trackIntelligence.energy.lead')}</p>
      </header>

      <div className="ti-bigviz">
        <span className="ti-hudlbl ti-hudtop-l uppercase">{t('trackIntelligence.energy.panelLabel')}</span>
        <span className="ti-truth ti-hudtop-r uppercase">{t('trackIntelligence.energy.sampleData')}</span>

        <svg viewBox="0 0 1160 320" role="img" aria-label={t('trackIntelligence.energy.figureAlt')}>
          {SECTIONS.map((sec) => {
            const x = x0 + (sec.t0 / TRACK.dur) * w;
            return sec.t0 > 0 ? (
              <g key={sec.n}>
                <line
                  x1={x}
                  y1={y0}
                  x2={x}
                  y2={y0 + h + 30}
                  stroke="rgba(255,255,255,.1)"
                  strokeDasharray="1 4"
                />
                <SvgText x={x0 + (((sec.t0 + sec.t1) / 2) / TRACK.dur) * w} y={y0 + h + 52} anchor="middle">
                  {sec.n}
                </SvgText>
              </g>
            ) : (
              <SvgText
                key={sec.n}
                x={x0 + (((sec.t0 + sec.t1) / 2) / TRACK.dur) * w}
                y={y0 + h + 52}
                anchor="middle"
              >
                {sec.n}
              </SvgText>
            );
          })}
          <path d={bandPath} fill="rgba(255,255,255,.07)" stroke="none" />
          <path
            d={contourD((tick) => (lAt(tick) + 14) / 8, x0, y0, w, h, 0, 1)}
            stroke="rgba(255,255,255,.45)"
            strokeWidth={1.2}
            fill="none"
          />
          <path
            d={contourD(eAt, x0, y0, w, h, 0, 1)}
            stroke="#fff"
            strokeWidth={2}
            fill="none"
            opacity={0.9}
            className={drawCls()}
          />
          <circle cx={px} cy={py} r={5} fill="#EE4A26" />
          <SvgText x={px} y={py - 14} className="ti-slbl ti-slbl-hot" anchor="middle">
            GLOBAL PEAK · DROP 02
          </SvgText>
          <SvgText x={12} y={y0 + 10}>
            HIGH
          </SvgText>
          <SvgText x={12} y={y0 + h}>
            LOW
          </SvgText>
        </svg>

        <div className="ti-legend">
          <span>
            <i />{t('trackIntelligence.energy.legendEnergy')}
          </span>
          <span>
            <i className="ti-gi" />{t('trackIntelligence.energy.legendLoudness')}
          </span>
          <span>
            <i className="ti-bi" />{t('trackIntelligence.energy.legendDynamic')}
          </span>
          <span>
            <i className="ti-oi" />{t('trackIntelligence.energy.legendPeak')}
          </span>
        </div>
      </div>

      <div className="ti-split2 mt-[var(--px-32)]">
        <div>
          <p className="ti-interp">{renderBoldParts(t('trackIntelligence.energy.readingInterp'))}</p>
          <span className="ti-truth inline-block mt-[var(--px-14)] uppercase">
            {t('trackIntelligence.energy.interpTruth')}
          </span>
        </div>
        <p className="ti-body">{t('trackIntelligence.energy.body')}</p>
      </div>
    </section>
  );
}
