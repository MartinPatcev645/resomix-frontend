import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawClusters(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const light = document.documentElement.classList.contains('light');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement?.clientWidth ?? 520;
  const cssH = Math.round(cssW * (300 / 520));

  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  ctx.scale(dpr, dpr);

  const W = cssW;
  const H = cssH;
  const rnd = mulberry32(20260722);
  ctx.clearRect(0, 0, W, H);

  const inkDim = light ? 'rgba(16,16,16,' : 'rgba(255,255,255,';
  const orange = '#EE4A26';
  const clusters = [
    { x: 120, y: 110, r: 62, n: 14 },
    { x: 360, y: 90, r: 58, n: 12 },
    { x: 300, y: 232, r: 50, n: 10 },
  ];

  const pts: { x: number; y: number; c: number }[] = [];
  clusters.forEach((c, ci) => {
    for (let i = 0; i < c.n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * c.r;
      pts.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, c: ci });
    }
  });

  ctx.lineWidth = 0.6;
  pts.forEach((p, i) => {
    for (let j = i + 1; j < pts.length; j++) {
      const q = pts[j];
      if (p.c !== q.c) continue;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      if (dx * dx + dy * dy < 2300 && rnd() < 0.3) {
        ctx.strokeStyle = inkDim + (p.c === 2 ? '.06)' : '.12)');
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }
  });

  const hot = [pts[3], pts[clusters[0].n + 4], pts[clusters[0].n + clusters[1].n + 5]];
  ctx.strokeStyle = orange;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(hot[0].x, hot[0].y);
  ctx.quadraticCurveTo((hot[0].x + hot[1].x) / 2, hot[0].y - 30, hot[1].x, hot[1].y);
  ctx.quadraticCurveTo((hot[1].x + hot[2].x) / 2, hot[2].y - 40, hot[2].x, hot[2].y);
  ctx.stroke();
  ctx.setLineDash([]);

  pts.forEach((p) => {
    const dormant = p.c === 2;
    ctx.fillStyle = dormant ? inkDim + '.25)' : inkDim + '.75)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, dormant ? 1.6 : 2.2, 0, 7);
    ctx.fill();
  });

  [hot[0], hot[2]].forEach((p) => {
    ctx.fillStyle = orange;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.4, 0, 7);
    ctx.fill();
    ctx.strokeStyle = orange;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, 7);
    ctx.stroke();
  });

  ctx.fillStyle = orange;
  ctx.beginPath();
  ctx.arc(hot[1].x, hot[1].y, 2.6, 0, 7);
  ctx.fill();
}

const REGIONS = [
  { labelKey: 'region1' as const, left: '8%', top: '10%' },
  { labelKey: 'region2' as const, left: '58%', top: '4%' },
  { labelKey: 'region3' as const, left: '46%', top: '80%' },
];

export function CatalogueSchematic() {
  const { t } = useTranslation('common');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => drawClusters(canvas);
    redraw();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
    const parent = canvas.parentElement;
    ro?.observe(parent ?? canvas);
    window.addEventListener('resize', redraw);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', redraw);
    };
  }, []);

  return (
    <section id="catalogue-intelligence" aria-label="Catalogue Intelligence proof">
      <div className="product-feature-grid product-feature-grid-57">
        <div className="product-feature-copy">
          <p className="product-microtag product-microtag-orange">
            {t('product.ci.tag')}
            <span className="product-badge product-microtag-muted">{t('product.ci.badge')}</span>
          </p>
          <h3 className="product-copy-col-title m-0 font-helvetica uppercase font-light text-[length:var(--px-33)] leading-[var(--px-38)] text-[var(--color-primary)]">
            {t('product.ci.title')}
          </h3>
          <p className="max-w-[48ch] font-helvetica font-light text-[length:var(--px-17)] opacity-70 leading-[var(--px-24)]">
            {t('product.ci.desc')}
          </p>
          <Link to="/partners/pilot" className="product-bracket-link">
            {t('product.ci.link')}
          </Link>
        </div>

        <figure
          className="product-hud product-feature-panel"
          aria-label="Catalogue relationship schematic, not product UI: three labelled clusters of recordings; dormant grey nodes, brighter connected nodes, two selected orange nodes and one highlighted relationship path"
        >
          <figcaption className="product-hud-label">{t('product.ci.panelLabel')}</figcaption>

          <div className="relative">
            <canvas ref={canvasRef} className="product-cluster-canvas" />
            {REGIONS.map(({ labelKey, left, top }) => (
              <span key={labelKey} className="product-region-lbl" style={{ left, top }}>
                {t(`product.ci.${labelKey}`)}
              </span>
            ))}
          </div>

          <p className="product-hud-foot">{t('product.ci.foot')}</p>
        </figure>
      </div>
    </section>
  );
}
