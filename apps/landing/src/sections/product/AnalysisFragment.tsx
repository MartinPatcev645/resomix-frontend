import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const TIMELINE = [
  { label: 'INTRO', width: '18%', active: false },
  { label: 'BUILD', width: '24%', active: false },
  { label: 'DROP', width: '22%', active: true },
  { label: 'BREAK', width: '16%', active: false },
  { label: 'OUTRO', width: '20%', active: false },
];

interface AnalysisFragmentProps {
  motionOn: boolean;
}

export function AnalysisFragment({ motionOn }: AnalysisFragmentProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const svgRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const el = svgRef.current;
    if (!el) return;

    try {
      const len = Math.ceil(el.getTotalLength());
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
      el.classList.add('product-armed');
    } catch {
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('product-play');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [motionOn]);

  return (
    <section id="track-intelligence" aria-label="Track Intelligence proof">
      <div className="product-feature-grid product-feature-grid-75">
        <figure
          className="product-hud product-feature-panel"
          aria-label="Analysis fragment, sample data: structure timeline of intro, build, drop, break, outro; energy curve; measured values 124 BPM, key 8A, minus 7.2 LUFS; predicted values deep house, dark, synth-led"
        >
          <figcaption className="product-hud-label">{t('product.ti.panelLabel')}</figcaption>

          <div className="product-timeline">
            {TIMELINE.map((seg) => (
              <span
                key={seg.label}
                style={{ flex: `0 0 ${seg.width}` }}
                className={`product-timeline-seg${seg.active ? ' product-timeline-seg-active' : ''}`}
              >
                {seg.label}
              </span>
            ))}
          </div>

          <svg className="product-energy" viewBox="0 0 520 70" aria-hidden="true">
            <path
              ref={svgRef}
              className="product-wavepath product-draw"
              d="M0 60 C 60 55 90 40 130 38 S 200 20 250 14 S 330 30 380 42 S 470 58 520 60"
              fill="none"
            />
          </svg>

          <div className="product-mp-grid">
            <div>
              <span className="product-mp-label">{t('product.ti.measured')}</span>
              <p className="product-measured-val text-[var(--color-primary)]">{t('product.ti.measuredVals')}</p>
            </div>
            <div>
              <span className="product-mp-label">{t('product.ti.predicted')}</span>
              <p className="product-measured-val text-[var(--color-primary)]">{t('product.ti.predictedVals')}</p>
            </div>
          </div>
        </figure>

        <div className="product-feature-copy">
          <p className="product-microtag product-microtag-orange">
            {t('product.ti.tag')}
            <span className="product-badge product-microtag-muted">{t('product.ti.badge')}</span>
          </p>
          <h3 className="product-copy-col-title m-0 font-helvetica uppercase font-light text-[length:var(--px-33)] leading-[var(--px-38)] text-[var(--color-primary)]">
            {t('product.ti.title')}
          </h3>
          <p className="max-w-[48ch] font-helvetica font-light text-[length:var(--px-17)] opacity-70 leading-[var(--px-24)]">
            {t('product.ti.desc')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/product/track-intelligence')}
            className="product-bracket-link"
          >
            {t('product.ti.link')}
          </button>
        </div>
      </div>
    </section>
  );
}
