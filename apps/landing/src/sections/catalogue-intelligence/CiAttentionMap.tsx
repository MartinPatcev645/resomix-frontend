import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CLUSTERS, MATRIX, rngFor } from './ciEngine.ts';
import { SvgText } from './ciSvgHelpers.tsx';

export function CiAttentionMap() {
  const { t } = useTranslation('common');
  const [mapSel, setMapSel] = useState('c2');
  const [openMatrix, setOpenMatrix] = useState<number | null>(null);

  const cluster = CLUSTERS.find((c) => c.id === mapSel)!;

  const mapNodes = useMemo(() => {
    const W = 720;
    const H = 480;
    return CLUSTERS.flatMap((c) => {
      const r = rngFor(`cl${c.id}`);
      const n = Math.min(60, Math.max(8, Math.round(c.count / 8)));
      const dots = [];
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const rad = Math.sqrt(r());
        dots.push({
          clusterId: c.id,
          cx: Number((c.cx * W + Math.cos(a) * c.r * W * rad).toFixed(1)),
          cy: Number((c.cy * H + Math.sin(a) * c.r * H * rad).toFixed(1)),
          opacity: r() < 0.4 ? 0.14 : 0.3,
        });
      }
      return dots;
    });
  }, []);

  return (
    <section id="ci-attention" className="ci-section" aria-label="See where the catalogue needs attention">
      <header className="ci-dim-intro">
        <p className="ci-eyebrow uppercase">{t('catalogueIntelligence.attention.eyebrow')}</p>
        <h2 className="ci-h2b uppercase">{t('catalogueIntelligence.attention.title')}</h2>
        <p className="ci-lead">{t('catalogueIntelligence.attention.lead')}</p>
      </header>

      <div className="ci-map-wrap">
        <div className="ci-mapviz">
          <span className="ci-hudlbl ci-hudtop-l uppercase">{t('catalogueIntelligence.attention.mapLabel')}</span>
          <span className="ci-truth ci-truth-hot ci-hudtop-r uppercase">
            {t('catalogueIntelligence.attention.mapTruth')}
          </span>
          <svg viewBox="0 0 720 480" role="img" aria-label={t('catalogueIntelligence.attention.mapAlt')}>
            {mapNodes.map((dot, i) => (
              <circle key={i} cx={dot.cx} cy={dot.cy} r={2} fill={`rgba(255,255,255,${dot.opacity})`} />
            ))}
            {CLUSTERS.map((c) => {
              const sel = c.id === mapSel;
              return (
                <g key={c.id}>
                  <ellipse
                    cx={c.cx * 720}
                    cy={c.cy * 480}
                    rx={c.r * 720 + 12}
                    ry={c.r * 480 + 12}
                    fill={sel ? 'rgba(238,74,38,.05)' : 'none'}
                    stroke={sel ? '#EE4A26' : 'rgba(255,255,255,.16)'}
                    strokeDasharray={sel ? 'none' : '2 5'}
                    strokeWidth={sel ? 1.4 : 1}
                  />
                  <SvgText
                    x={c.cx * 720}
                    y={c.cy * 480 - c.r * 480 - 20}
                    className={sel ? 'ci-slbl ci-slbl-hot' : 'ci-slbl-dim'}
                    anchor="middle"
                  >
                    {`${c.name} · ${c.count}`}
                  </SvgText>
                </g>
              );
            })}
          </svg>
          <div className="ci-viz-foot">
            <span className="ci-lbl-dim">{t('catalogueIntelligence.attention.mapFoot')}</span>
          </div>
        </div>

        <div className="ci-cluster-detail">
          <span className="ci-hudlbl ci-hudtop-l uppercase">{t('catalogueIntelligence.attention.clusterLabel')}</span>
          <div className="ci-clusterbtns" role="group" aria-label={t('catalogueIntelligence.attention.clusterGroupLabel')}>
            {CLUSTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="ci-iconbtn"
                aria-pressed={mapSel === c.id}
                onClick={() => setMapSel(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="ci-rows">
            <div className="ci-row">
              <span className="ci-k uppercase">{t('catalogueIntelligence.attention.clusterRows.tracks')}</span>
              <span className="ci-v">{cluster.count} · sample</span>
            </div>
            <div className="ci-row">
              <span className="ci-k uppercase">{t('catalogueIntelligence.attention.clusterRows.chars')}</span>
              <span className="ci-v">{cluster.chars}</span>
            </div>
            <div className="ci-row">
              <span className="ci-k uppercase">{t('catalogueIntelligence.attention.clusterRows.years')}</span>
              <span className="ci-v">{cluster.years}</span>
            </div>
            <div className="ci-row">
              <span className="ci-k uppercase">{t('catalogueIntelligence.attention.clusterRows.meta')}</span>
              <span className="ci-v">{cluster.meta}</span>
            </div>
          </div>
          <p className="ci-interp mt-[var(--px-20)]">
            <b>{t('catalogueIntelligence.attention.reviewPrefix')}</b> {cluster.q}
          </p>
        </div>
      </div>

      <div className="ci-hudpad mt-[var(--px-32)]">
        <span className="ci-hudlbl ci-hudtop-l uppercase">{t('catalogueIntelligence.attention.matrixLabel')}</span>
        <div
          className="ci-matrix mt-[var(--px-32)]"
          role="table"
          aria-label={t('catalogueIntelligence.attention.matrixAlt')}
        >
          <div className="ci-mrow ci-mrow-mhead" role="row">
            <span>{t('catalogueIntelligence.attention.matrixHead.field')}</span>
            <span>{t('catalogueIntelligence.attention.matrixHead.stored')}</span>
            <span>{t('catalogueIntelligence.attention.matrixHead.measured')}</span>
            <span>{t('catalogueIntelligence.attention.matrixHead.status')}</span>
          </div>
          {MATRIX.map((row, i) => (
            <div
              key={row.k}
              className={`ci-mrow${row.ex ? ' ci-mrow-extra' : ''}`}
              role="row"
              data-open={openMatrix === i ? 'true' : 'false'}
            >
              <span className="ci-k uppercase">{row.k}</span>
              <span className="ci-v">{row.s}</span>
              <span className="ci-v">{row.m}</span>
              <button
                type="button"
                className={`ci-st ${row.cls === 'st-ok' ? 'ci-st-ok' : row.cls === 'st-conf' ? 'ci-st-conf' : 'ci-st-rev'}`}
                aria-expanded={openMatrix === i}
                onClick={() => setOpenMatrix((prev) => (prev === i ? null : i))}
              >
                {row.st}
              </button>
              <div className="ci-detail">
                <p className="ci-lbl-dim" style={{ textTransform: 'none', letterSpacing: '0.02em' }}>
                  {row.d}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="ci-lbl-dim mt-[var(--px-16)]">{t('catalogueIntelligence.attention.matrixFoot')}</p>
      </div>
    </section>
  );
}
