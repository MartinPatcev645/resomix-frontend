import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const REFERENCE_WAVE = 'M0 12 q3 -8 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0';

const MATCHES = [
  { score: 94, title: 'MIDNIGHT CIRCUIT', meta: '123 BPM · 8A', wave: 'M0 12 q3 -10 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0' },
  { score: 91, title: 'LOW ORBIT', meta: '125 BPM · 8B', wave: 'M0 12 q3 -6 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0' },
  { score: 88, title: 'GLASS SIGNAL', meta: '122 BPM · 7A', wave: 'M0 12 q3 -9 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0' },
];

export function SimilarityProof() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section id="sonic-discovery" aria-label="Sonic Discovery proof">
      <div className="product-feature-grid product-feature-grid-57">
        <div className="product-feature-copy">
          <p className="product-microtag product-microtag-orange">
            {t('product.sd.tag')}
            <span className="product-dot" />
          </p>
          <h3 className="product-copy-col-title m-0 font-helvetica uppercase font-light text-[length:var(--px-33)] leading-[var(--px-38)] text-[var(--color-primary)]">
            {t('product.sd.title')}
          </h3>
          <p className="max-w-[48ch] font-helvetica font-light text-[length:var(--px-17)] opacity-70 leading-[var(--px-24)]">
            {t('product.sd.desc')}
          </p>
          <button
            type="button"
            className="product-bracket-link"
            onClick={() => navigate('/product/sonic-discovery')}
          >
            {t('product.sd.link')}
          </button>
        </div>

        <figure
          className="product-hud product-feature-panel"
          aria-label="Similarity result panel rebuilt from product patterns: a reference track and three scored matches with waveforms"
        >
          <figcaption className="product-hud-label">{t('product.sd.panelLabel')}</figcaption>

          <div className="product-trackrow product-trackrow-ref">
            <span>♪</span>
            <span className="tracking-[0.03em] shrink-0">REFERENCE_TRACK.WAV</span>
            <span className="product-meta-muted shrink-0 max-[600px]:hidden">124 BPM · 8A</span>
            <svg className="product-wave" viewBox="0 0 120 24" aria-hidden="true">
              <path className="product-wavepath" d={REFERENCE_WAVE} />
            </svg>
          </div>

          <ol className="list-none m-0 p-0">
            {MATCHES.map((m) => (
              <li key={m.title} className="product-trackrow">
                <span className="product-score">{m.score}</span>
                <span className="tracking-[0.03em] shrink-0">{m.title}</span>
                <span className="product-meta-muted shrink-0 max-[600px]:hidden">{m.meta}</span>
                <svg className="product-wave" viewBox="0 0 120 24" aria-hidden="true">
                  <path className="product-wavepath" d={m.wave} />
                </svg>
              </li>
            ))}
          </ol>

          <p className="product-hud-foot">{t('product.sd.foot')}</p>
        </figure>
      </div>
    </section>
  );
}
