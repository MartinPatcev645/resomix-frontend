import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BLOG } from '@/routes/blogLinks.ts';
import {
  MODES,
  LANE_ORDER,
  TRACK,
  type ModeKey,
  type LensKey,
  eAt,
  contourD,
  sectionBlocks,
  waveBarsPath,
  lensTimbrePath,
} from './tiEngine.ts';
import { SvgText } from './tiSvgHelpers.tsx';

const API_DOCS_URL = 'https://api-docs.resomix.com/';

/** Blog destination per lens mode, from the interlinking map. Only MB-08's sibling MB-11 is mapped. */
const LENS_MODE_BLOG: Partial<Record<ModeKey, string>> = { dj: BLOG.techno };

const MODE_KEYS: ModeKey[] = ['dj', 'prod', 'label', 'sup', 'api'];

function renderChipHtml(html: string) {
  const parts = html.split(/(<b>.*?<\/b>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<b>') && part.endsWith('</b>')) {
      return <b key={i}>{part.slice(3, -4)}</b>;
    }
    return part;
  });
}

function LensViz({ lanes }: { lanes: LensKey[] }) {
  return (
    <svg viewBox="0 0 720 300" role="img" aria-label="Compact anatomy thumbnail: the track spine with its analysis lanes; the lanes this profession reads most are lit, the others recede. Sample data.">
      <path
        d={waveBarsPath('lensmini', 150, 44, 540, 40, 90)}
        stroke="rgba(255,255,255,.75)"
        strokeWidth={1.2}
        fill="none"
      />
      <SvgText x={12} y={48}>
        SPINE
      </SvgText>
      {LANE_ORDER.map((key, i) => {
        const y = 92 + i * 42;
        const on = lanes.indexOf(key) >= 0;
        return (
          <g key={key} opacity={on ? 1 : 0.3}>
            <SvgText x={12} y={y + 14} className={on ? 'ti-slbl ti-slbl-hot' : 'ti-slbl-dim'}>
              {key.toUpperCase()}
            </SvgText>
            {key === 'structure' &&
              sectionBlocks(150, y, 540, 22, false, -1).map((b) => (
                <rect
                  key={b.label}
                  x={b.x}
                  y={y}
                  width={b.width}
                  height={22}
                  fill="none"
                  stroke={b.isDrop ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.3)'}
                  strokeWidth={1}
                />
              ))}
            {key === 'energy' && (
              <path
                d={contourD(eAt, 150, y, 540, 22, 0, 1)}
                stroke={on ? '#fff' : 'rgba(255,255,255,.6)'}
                strokeWidth={1.3}
                fill="none"
              />
            )}
            {key === 'harmony' && (
              <>
                <rect x={150} y={y} width={540} height={22} fill="none" stroke="rgba(255,255,255,.25)" />
                <rect
                  x={150 + 540 * (184 / TRACK.dur)}
                  y={y}
                  width={540 * (68 / TRACK.dur)}
                  height={22}
                  fill="rgba(238,74,38,.22)"
                />
              </>
            )}
            {key === 'timbre' && (
              <path
                d={lensTimbrePath('lens-t', 150, y, 540)}
                stroke="rgba(255,255,255,.6)"
                strokeWidth={1.1}
                fill="none"
              />
            )}
            {key === 'identity' &&
              ['DEEP HOUSE', 'DARK', 'SYNTH-LED'].map((c, ci) => (
                <g key={c}>
                  <rect
                    x={150 + ci * 186}
                    y={y}
                    width={170}
                    height={22}
                    fill="none"
                    stroke={ci === 0 && on ? '#EE4A26' : 'rgba(255,255,255,.25)'}
                  />
                  <SvgText x={150 + ci * 186 + 8} y={y + 15}>
                    {c}
                  </SvgText>
                </g>
              ))}
          </g>
        );
      })}
    </svg>
  );
}

type TiLensModesProps = {
  onScrollToProfile: () => void;
};

export function TiLensModes({ onScrollToProfile }: TiLensModesProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [mode, setMode] = useState<ModeKey>('dj');
  const m = MODES[mode];

  const handleCta = () => {
    if (mode === 'label') {
      navigate('/partners/pilot');
      return;
    }
    if (mode === 'api') {
      window.open(API_DOCS_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    onScrollToProfile();
  };

  const ctaLabel = useMemo(() => t(`trackIntelligence.decision.modes.${mode}.cta`), [t, mode]);

  return (
    <section id="ti-decision" className="ti-section" aria-label="From data to decision">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.decision.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.decision.title')}</h2>
      </header>

      <div className="ti-seg" role="group" aria-label="Professional mode">
        {MODE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
          >
            {t(`trackIntelligence.decision.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className="ti-lensmode">
        <div>
          <h3 className="ti-h3b uppercase">{t(`trackIntelligence.decision.modes.${mode}.head`)}</h3>
          <p className="ti-body">
            {/* MB-11. Only the DJ mode is mapped to a blog post. */}
            <Trans
              i18nKey={`trackIntelligence.decision.modes.${mode}.copy`}
              components={{ a: <a className="rx-copylink" href={LENS_MODE_BLOG[mode] ?? ''} /> }}
            />
          </p>
          <ul className="ti-lensattrs">
            {(t(`trackIntelligence.decision.modes.${mode}.attrs`, { returnObjects: true }) as string[]).map(
              (attr) => (
                <li key={attr}>{attr}</li>
              ),
            )}
          </ul>
          <p className="ti-interp ti-outcome">{t(`trackIntelligence.decision.modes.${mode}.outcome`)}</p>
          <button type="button" className="ti-pill ti-pill-line uppercase mt-[var(--px-20)]" onClick={handleCta}>
            {ctaLabel}
          </button>
        </div>
        <div className="ti-lens-viz">
          <span className="ti-hudlbl ti-hudtop-l uppercase" aria-live="polite">
            {m.vizlbl}
          </span>
          <div className="ti-idchips mb-[var(--px-16)]" aria-live="polite">
            {m.chips.map((chip) => (
              <span key={chip} className="ti-chip">
                {renderChipHtml(chip)}
              </span>
            ))}
          </div>
          <LensViz lanes={m.lanes} />
        </div>
      </div>
    </section>
  );
}
