import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CI_REFS,
  REGIONS,
  drawCls,
  fieldNodes,
  rngFor,
  type FieldState,
} from './ciEngine.ts';
import { SvgText } from './ciSvgHelpers.tsx';

interface CiActivationHeroProps {
  fieldState: FieldState;
  onFieldStateChange: (next: FieldState) => void;
  onScrollToHow: () => void;
}

function renderEyebrow(text: string) {
  const highlight = 'PRIVATE PILOT';
  const idx = text.indexOf(highlight);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="ci-o">{highlight}</span>
      {text.slice(idx + highlight.length)}
    </>
  );
}

function FieldSvg({
  desktop,
  fieldState,
}: {
  desktop: boolean;
  fieldState: FieldState;
}) {
  const ref = CI_REFS[fieldState.ref];
  const x0 = desktop ? 170 : 12;
  const fw = desktop ? 1160 - 190 : 336;
  const fh = desktop ? 470 : 390;
  const y0 = desktop ? 26 : 36;
  const px = (v: number) => x0 + v * fw;
  const py = (v: number) => y0 + v * fh;

  const nodes = useMemo(
    () => fieldNodes(desktop ? 'field' : 'field-m'),
    [desktop],
  );
  const keep = desktop ? nodes : nodes.filter((_, i) => i % 2 === 0);

  const ey = desktop ? py(0.46) : 18;

  const refWave = useMemo(() => {
    const r = rngFor(`refwave${fieldState.ref}`);
    let d = '';
    for (let i = 0; i < 26; i++) {
      const bh = 16 * (0.4 + 0.6 * r());
      d += `M${8 + i * 5} ${ey + 14 - bh / 2}L${8 + i * 5} ${ey + 14 + bh / 2}`;
    }
    return d;
  }, [fieldState.ref, ey]);

  return (
    <svg
      viewBox={desktop ? '0 0 1160 520' : '0 0 360 440'}
      aria-hidden="true"
      focusable="false"
    >
      {REGIONS.map((rg) => (
        <g key={rg.id}>
          <ellipse
            cx={px(rg.cx)}
            cy={py(rg.cy)}
            rx={rg.rx * fw + 14}
            ry={rg.ry * fh + 14}
            fill="none"
            stroke="rgba(255,255,255,.10)"
            strokeDasharray="2 5"
          />
          {desktop && (
            <SvgText x={px(rg.cx)} y={py(rg.cy - rg.ry) - 10} anchor="middle">
              {rg.name}
            </SvgText>
          )}
        </g>
      ))}

      {keep.map((n, i) => (
        <circle
          key={i}
          cx={Number(px(n.x).toFixed(1))}
          cy={Number(py(n.y).toFixed(1))}
          r={desktop ? 2.2 : 1.8}
          fill={`rgba(255,255,255,${n.old ? '.13' : '.30'})`}
        />
      ))}

      {desktop ? (
        <>
          <SvgText x={8} y={ey - 26} className="ci-slbl">
            REFERENCE IN
          </SvgText>
          <SvgText x={8} y={ey - 10}>
            {`${ref.t} · ${ref.year}`}
          </SvgText>
          <path d={refWave} stroke="#fff" strokeWidth={2} opacity={0.8} fill="none" />
          <circle cx={x0 - 14} cy={ey + 14} r={4} fill="#EE4A26" />
        </>
      ) : (
        <SvgText x={12} y={ey} className="ci-slbl">
          {`REFERENCE: ${ref.t} · ${ref.year}`}
        </SvgText>
      )}

      <g className="ci-links">
        {ref.results.map((res, i) => {
          const rg = REGIONS.find((x) => x.id === res.region)!;
          const rr = rngFor(`res${fieldState.ref}${i}`);
          const nx = px(rg.cx + (rr() - 0.5) * rg.rx);
          const ny = py(rg.cy + (rr() - 0.5) * rg.ry);
          const sx = desktop ? x0 - 10 : px(0.05);
          const sy = desktop ? ey + 14 : py(0.02);
          const selected = i === fieldState.sel;

          return (
            <g key={res.t}>
              <path
                d={`M${sx} ${sy} C ${sx + 70} ${sy} ${nx - 80} ${ny} ${nx - 6} ${ny}`}
                stroke={selected ? '#EE4A26' : 'rgba(238,74,38,.35)'}
                strokeWidth={selected ? 1.6 : 1}
                fill="none"
                className={drawCls()}
              />
              <circle
                cx={nx}
                cy={ny}
                r={selected ? 6 : 4.5}
                fill={selected ? '#EE4A26' : 'rgba(238,74,38,.8)'}
              />
              {selected && (
                <circle
                  cx={nx}
                  cy={ny}
                  r={11}
                  fill="none"
                  stroke="#EE4A26"
                  strokeDasharray="2 3"
                />
              )}
              {(desktop || selected) && (
                <SvgText
                  x={nx + 14}
                  y={ny + 4}
                  className={selected ? 'ci-slbl ci-slbl-hot' : 'ci-slbl-dim'}
                >
                  {`${res.year}${res.old ? ' · LOW EXPOSURE' : ''}`}
                </SvgText>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function CiActivationHero({
  fieldState,
  onFieldStateChange,
  onScrollToHow,
}: CiActivationHeroProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const ref = CI_REFS[fieldState.ref];

  return (
    <section id="ci-hero" className="ci-section" aria-label="Catalogue Intelligence introduction">
      <div className="ci-hero-head">
        <p className="ci-eyebrow uppercase">{renderEyebrow(t('catalogueIntelligence.hero.eyebrow'))}</p>
        <h1 className="ci-benzin-d font-benzin uppercase">
          {t('catalogueIntelligence.hero.titleLine1')}
          <br />
          {t('catalogueIntelligence.hero.titleLine2')}
        </h1>
        <p className="ci-body ci-sub">{t('catalogueIntelligence.hero.sub')}</p>
        <div className="ci-ctarow">
          <button
            type="button"
            className="ci-pill ci-pill-solid uppercase"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('catalogueIntelligence.hero.ctaPrimary')}
          </button>
          <button type="button" className="ci-pill ci-pill-line uppercase" onClick={onScrollToHow}>
            {t('catalogueIntelligence.hero.ctaSecondary')}
          </button>
        </div>
      </div>

      <div className="ci-field-wrap">
        <div className="ci-field">
          <span className="ci-hudlbl ci-hudtop-l uppercase">{t('catalogueIntelligence.hero.fieldLabel')}</span>
          <span className="ci-hudtop-r">
            <span className="ci-truth ci-truth-hot uppercase">
              {t('catalogueIntelligence.hero.sampleData')}
            </span>
          </span>
          <div className="ci-refpick" role="group" aria-label={t('catalogueIntelligence.hero.refGroupLabel')}>
            <span className="ci-lbl uppercase self-center">{t('catalogueIntelligence.hero.refCaption')}</span>
            <button
              type="button"
              className="ci-iconbtn"
              aria-pressed={fieldState.ref === 'a'}
              onClick={() => onFieldStateChange({ ref: 'a', sel: 0 })}
            >
              COLD LATITUDE · 2026
            </button>
            <button
              type="button"
              className="ci-iconbtn"
              aria-pressed={fieldState.ref === 'b'}
              onClick={() => onFieldStateChange({ ref: 'b', sel: 0 })}
            >
              VERDE STATIC · 2024
            </button>
          </div>
          <figure role="img" aria-label={t('catalogueIntelligence.hero.figureAlt')}>
            <div className="ci-field-d">
              <FieldSvg desktop fieldState={fieldState} />
            </div>
            <div className="ci-field-m">
              <FieldSvg desktop={false} fieldState={fieldState} />
            </div>
          </figure>
          <div className="ci-field-foot">
            <span className="ci-lbl-dim">{t('catalogueIntelligence.hero.fieldFoot')}</span>
          </div>
        </div>

        <div className="ci-rail" role="group" aria-label={t('catalogueIntelligence.hero.railLabel')}>
          <span className="ci-lbl uppercase">{t('catalogueIntelligence.hero.railTitle')}</span>
          {ref.results.map((res, i) => (
            <button
              key={res.t}
              type="button"
              className="ci-railbtn"
              aria-pressed={fieldState.sel === i}
              onClick={() => onFieldStateChange({ ...fieldState, sel: i })}
            >
              <span className="ci-yr">{res.year}</span>
              <span className="ci-tt">
                {res.t} — {res.a}
              </span>
              <span className="ci-why">
                {res.why}
                {res.old && (
                  <>
                    {' · '}
                    <b style={{ color: 'var(--color-neon-orange)' }}>surfaced from low exposure</b>
                  </>
                )}
              </span>
            </button>
          ))}
          <span className="ci-lbl-dim">{t('catalogueIntelligence.hero.railHint')}</span>
        </div>
      </div>
    </section>
  );
}
