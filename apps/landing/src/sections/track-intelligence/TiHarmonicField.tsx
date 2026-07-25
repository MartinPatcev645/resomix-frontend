import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TRACK,
  agreeAt,
  contourD,
  chromaStripCells,
  chromagramCells,
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

const CHROMA_PCS = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
const STRIP_PCS = ['G', 'A#', 'D', 'F', 'C', 'other'];

export function TiHarmonicField() {
  const { t } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);
  const x0 = 40;
  const w = 580;
  const y0 = 28;
  const h = 110;
  const sy = 196;
  const rh = 15;

  const stripCells = useMemo(() => chromaStripCells(x0, w, sy, rh), [x0, w, sy, rh]);
  const fullCells = useMemo(() => chromagramCells(48, 1030, 16, 18), []);

  const bx = x0 + (184 / TRACK.dur) * w;
  const bw2 = (68 / TRACK.dur) * w;

  return (
    <section id="ti-harmony" className="ti-section" aria-label="Harmony and pitch">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.harmony.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.harmony.title')}</h2>
        <p className="ti-lead">{t('trackIntelligence.harmony.lead')}</p>
      </header>

      <div className="ti-bigviz">
        <span className="ti-hudlbl ti-hudtop-l uppercase">{t('trackIntelligence.harmony.panelLabel')}</span>
        <span className="ti-truth ti-hudtop-r uppercase">{t('trackIntelligence.harmony.sampleData')}</span>

        <div className="ti-split2">
          <div>
            <div className="ti-keypanel">
              <span className="ti-keybig uppercase">
                {t('trackIntelligence.harmony.keyMain')}{' '}
                <small>{t('trackIntelligence.harmony.keySub')}</small>
              </span>
              <span className="ti-conf">
                <span className="ti-lbl uppercase">{t('trackIntelligence.harmony.confLabel')}</span>
                <span
                  className="ti-confbar"
                  role="img"
                  aria-label={t('trackIntelligence.harmony.confAlt')}
                >
                  <i style={{ width: '88%' }} />
                </span>
                <span className="ti-lbl text-[var(--color-primary)] uppercase">
                  {t('trackIntelligence.harmony.confValue')}
                </span>
              </span>
            </div>
            <p className="ti-interp">{t('trackIntelligence.harmony.interp')}</p>
            <button
              type="button"
              className="ti-ghostbtn uppercase mt-[var(--px-24)]"
              aria-expanded={expanded}
              aria-controls="ti-harmexp"
              onClick={() => setExpanded((o) => !o)}
            >
              {expanded
                ? t('trackIntelligence.harmony.expanderHide')
                : t('trackIntelligence.harmony.expanderShow')}
            </button>
          </div>

          <svg viewBox="0 0 640 300" role="img" aria-label={t('trackIntelligence.harmony.tonalAlt')}>
            <line
              x1={x0}
              y1={y0 + h * 0.12}
              x2={x0 + w}
              y2={y0 + h * 0.12}
              stroke="rgba(255,255,255,.18)"
              strokeDasharray="1 4"
            />
            <SvgText x={x0} y={y0 + h * 0.12 - 8}>
              g minor centre
            </SvgText>
            <path
              d={contourD(agreeAt, x0, y0, w, h, 0, 1)}
              stroke="#fff"
              strokeWidth={1.8}
              fill="none"
              opacity={0.9}
              className={drawCls()}
            />
            <rect
              x={bx}
              y={y0}
              width={bw2}
              height={h}
              fill="rgba(238,74,38,.08)"
              stroke="#EE4A26"
              strokeDasharray="2 4"
            />
            <SvgText x={bx + bw2 / 2} y={y0 + h + 20} className="ti-slbl ti-slbl-hot" anchor="middle">
              BREAK · WIDER MOVEMENT
            </SvgText>
            <SvgText x={x0} y={y0 + h + 20}>
              stable
            </SvgText>
            <SvgText x={x0 + w} y={y0 + h + 20} anchor="end">
              stable
            </SvgText>
            <SvgText x={12} y={y0 + h / 2}>
              KEY
            </SvgText>
            <SvgText x={x0} y={sy - 8} className="ti-slbl">
              CHROMAGRAM STRIP · PITCH-CLASS ENERGY
            </SvgText>
            {STRIP_PCS.map((pc, row) => (
              <SvgText key={pc} x={12} y={sy + row * rh + 11}>
                {pc}
              </SvgText>
            ))}
            {stripCells.map((cell, i) => (
              <rect key={i} x={cell.x} y={cell.y} width={cell.width} height={cell.height} fill={cell.fill} />
            ))}
          </svg>
        </div>

        <div id="ti-harmexp" className={`ti-expandable${expanded ? ' ti-open' : ''}`}>
          <span className="ti-lbl uppercase">{t('trackIntelligence.harmony.chromaLabel')}</span>
          <svg viewBox="0 0 1100 260" role="img" aria-label={t('trackIntelligence.harmony.chromaAlt')}>
            {CHROMA_PCS.map((pc, row) => (
              <SvgText key={pc} x={10} y={16 + row * 18 + 13}>
                {pc}
              </SvgText>
            ))}
            {fullCells.map((cell, i) => (
              <rect key={i} x={cell.x} y={cell.y} width={cell.width} height={cell.height} fill={cell.fill} />
            ))}
            <SvgText x={48} y={250}>
              0:00
            </SvgText>
            <SvgText x={1078} y={250} anchor="end">
              {fmt(TRACK.dur)}
            </SvgText>
          </svg>
          <div className="ti-viz-foot">
            <span className="ti-lbl-dim">{t('trackIntelligence.harmony.chromaFoot1')}</span>
            <span className="ti-lbl-dim">{t('trackIntelligence.harmony.chromaFoot2')}</span>
          </div>
          <div className="mt-[var(--px-24)]">
            <span className="ti-lbl uppercase">{t('trackIntelligence.harmony.relLabel')}</span>
            <div className="ti-idchips mt-[var(--px-10)]">
              {(['chip1', 'chip2', 'chip3', 'chip4'] as const).map((key) => (
                <span key={key} className="ti-chip">
                  {renderBoldParts(t(`trackIntelligence.harmony.rel.${key}`))}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
