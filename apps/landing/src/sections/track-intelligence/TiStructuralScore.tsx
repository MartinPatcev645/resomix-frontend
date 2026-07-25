import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TRACK,
  SECTIONS,
  DEFAULT_SECTION_SEL,
  fmt,
  waveBarsPath,
  sectionBlocks,
} from './tiEngine.ts';
import { SvgText } from './tiSvgHelpers.tsx';

export function TiStructuralScore() {
  const { t } = useTranslation('common');
  const [sectSel, setSectSel] = useState(DEFAULT_SECTION_SEL);
  const s = SECTIONS[sectSel];
  const x0 = 60;
  const w = 1060;
  const blocks = sectionBlocks(x0, 200, w, 52, true, sectSel);

  const beatTicks = [];
  for (let tick = 0; tick <= TRACK.dur; tick += 7.74) {
    const x = x0 + (tick / TRACK.dur) * w;
    beatTicks.push(
      <line
        key={tick}
        x1={x}
        y1={172}
        x2={x}
        y2={tick % 30.96 < 1 ? 184 : 178}
        stroke={`rgba(255,255,255,${tick % 30.96 < 1 ? 0.4 : 0.18})`}
      />,
    );
  }

  const profNotes = ['djs', 'producers', 'supervisors', 'catalogue'] as const;

  return (
    <section id="ti-structure" className="ti-section" aria-label="Time and structure">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.structure.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.structure.title')}</h2>
        <p className="ti-lead">{t('trackIntelligence.structure.lead')}</p>
      </header>

      <div className="ti-score-wrap">
        <span className="ti-hudlbl ti-hudtop-l uppercase">{t('trackIntelligence.structure.panelLabel')}</span>
        <span className="ti-truth ti-hudtop-r uppercase">{t('trackIntelligence.structure.sampleData')}</span>

        <svg viewBox="0 0 1160 300" role="img" aria-label={t('trackIntelligence.structure.figureAlt')}>
          <SvgText x={12} y={110}>
            WAVE
          </SvgText>
          <path
            d={waveBarsPath('struct', x0, 110, w, 88, 180)}
            stroke="rgba(255,255,255,.75)"
            strokeWidth={1.2}
            fill="none"
          />
          <rect
            x={x0 + (s.t0 / TRACK.dur) * w}
            y={56}
            width={((s.t1 - s.t0) / TRACK.dur) * w}
            height={110}
            fill="rgba(238,74,38,.08)"
            stroke="#EE4A26"
            strokeDasharray="2 4"
          />
          <g>{beatTicks}</g>
          <SvgText x={12} y={182}>
            BEATS
          </SvgText>
          {blocks.map((b) => (
            <g key={b.label}>
              <rect
                x={b.x}
                y={200}
                width={b.width}
                height={52}
                fill={b.hot ? 'rgba(238,74,38,.10)' : 'none'}
                stroke={b.hot ? '#EE4A26' : b.isDrop ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.3)'}
                strokeWidth={b.hot ? 1.4 : 1}
              />
              <SvgText x={b.x + 6} y={216} className={b.hot ? 'ti-slbl ti-slbl-hot' : 'ti-slbl-dim'}>
                {b.label}
              </SvgText>
              <SvgText x={b.x + 6} y={244}>{b.duration}</SvgText>
            </g>
          ))}
          <SvgText x={x0} y={282}>
            0:00
          </SvgText>
          <SvgText x={x0 + w} y={282} anchor="end">
            {fmt(TRACK.dur)}
          </SvgText>
          <SvgText x={x0 + w / 2} y={282} anchor="middle">
            timeline · 124 bpm · beat grid: 4-bar ticks
          </SvgText>
        </svg>

        <div className="ti-sectbtns" role="group" aria-label="Select a section">
          {SECTIONS.map((sec, i) => (
            <button
              key={sec.n}
              type="button"
              className="ti-sectbtn uppercase"
              aria-pressed={sectSel === i}
              onClick={() => setSectSel(i)}
            >
              {sec.n} · {fmt(sec.t1 - sec.t0)}
            </button>
          ))}
        </div>

        <div className="ti-sect-read">
          <div className="ti-sect-stats">
            <span className="ti-chip">
              <b>{s.n}</b>
            </span>
            <span className="ti-chip">
              {fmt(s.t0)} → {fmt(s.t1)}
            </span>
            <span className="ti-chip">
              length <b>{fmt(s.t1 - s.t0)}</b>
            </span>
            <span className="ti-chip">
              energy <b>{Math.round(s.e * 100)}</b>
            </span>
            <span className="ti-chip">
              loudness <b>{s.lufs}</b> LUFS
            </span>
          </div>
          <p className="ti-interp" aria-live="polite">
            {s.role} {t('trackIntelligence.structure.roleSuffix')}
          </p>
        </div>
      </div>

      <ul className="ti-prof-notes" aria-label={t('trackIntelligence.structure.notesLabel')}>
        {profNotes.map((key) => (
          <li key={key}>
            <b className="uppercase">{t(`trackIntelligence.structure.notes.${key}.role`)}</b>
            {t(`trackIntelligence.structure.notes.${key}.text`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
