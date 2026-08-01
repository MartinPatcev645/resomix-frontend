import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ButtonHeavyRight, ButtonSleek } from '@resomix/ui';
import { BASE_BETA_URL } from '@resomix/config';

const ENDPOINTS = [
  { id: 'sonic-discovery', labelKey: 'ep1' as const, statusKey: 'ep1s' as const, y: '20%' },
  { id: 'track-intelligence', labelKey: 'ep2' as const, statusKey: 'ep2s' as const, y: '46%' },
  { id: 'catalogue-intelligence', labelKey: 'ep3' as const, statusKey: 'ep3s' as const, y: '72%' },
];

interface WovenSignalHeroProps {
  motionOn: boolean;
  onNavigateContact?: () => void;
}

export function WovenSignalHero({ motionOn }: WovenSignalHeroProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const drawEls = figureRef.current?.querySelectorAll('.product-draw');
    if (!drawEls?.length) return;

    drawEls.forEach((el) => {
      const path = el as SVGPathElement;
      try {
        const len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 1200;
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len);
        path.classList.add('product-armed');
      } catch {
        /* non-path element */
      }
    });

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

    drawEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [motionOn]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderTitle = () => {
    const title = t('product.hero.title');
    const dotIdx = title.indexOf('. ');
    if (dotIdx === -1) return title;
    const line1 = title.slice(0, dotIdx + 1);
    const line2 = title.slice(dotIdx + 2);
    return (
      <>
        {line1}
        <br />
        {line2}
      </>
    );
  };

  const labelNameStyle = {
    fontFamily: "'Fira Code', monospace",
    fontSize: 12,
    letterSpacing: '0.03em',
    fill: '#fff',
    opacity: 0.85,
  } as const;

  const labelStatusStyle = {
    fontFamily: "'Fira Code', monospace",
    fontSize: 11,
    letterSpacing: '0.05em',
    fill: '#6a6a6a',
    opacity: 0.9,
  } as const;

  const apiTitleStyle = {
    fontFamily: "'Fira Code', monospace",
    fontSize: 12,
    letterSpacing: '0.03em',
    fill: '#fff',
    opacity: 0.7,
  } as const;

  const apiStatusStyle = {
    fontFamily: "'Fira Code', monospace",
    fontSize: 11,
    letterSpacing: '0.05em',
    fill: '#6a6a6a',
    opacity: 0.85,
  } as const;

  return (
    <section className="product-hero-stack relative" aria-label="Resomix platform introduction">
      <div className="product-hero-copy min-w-0">
        <p className="product-microtag product-microtag-muted opacity-80">
          {t('product.hero.status')}
          <span className="product-dot" />
        </p>
        <h1 className="product-hero-title m-0 mb-[var(--px-20)] font-benzin uppercase text-[var(--color-primary)]">
          {renderTitle()}
        </h1>
        <p className="max-w-[54ch] m-0 mb-[var(--px-32)] font-helvetica font-light text-[length:var(--px-17)] opacity-70 leading-[var(--px-24)]">
          {t('product.hero.sub')}
        </p>
        <div className="flex gap-[var(--px-16)] flex-wrap">
          <ButtonHeavyRight
            text={t('product.hero.ctaPrimary')}
            onClick={() => {
              window.location.href = BASE_BETA_URL;
            }}
          />
          <ButtonSleek
            text={t('product.hero.ctaSecondary')}
            transparent
            onClick={() => navigate('/partners/pilot')}
          />
        </div>
      </div>

      <figure ref={figureRef} className="product-hero-figure m-0" aria-label={t('product.hero.figureAlt')}>
        <svg viewBox="0 0 1400 460" role="img" className="product-herosvg-d w-full h-auto block">
          <path
            className="product-fil product-draw product-f-in"
            d="M30 230 q12 -30 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0"
          />
          <g className="weave">
            <path className="product-fil product-draw product-w1" d="M270 230 C 350 150, 430 310, 510 230 S 670 150, 760 210" />
            <path className="product-fil product-draw product-w2" d="M270 230 C 350 310, 430 160, 510 250 S 670 310, 760 245" />
            <path className="product-fil product-draw product-w3" d="M270 228 C 360 190, 420 285, 530 200 S 690 190, 760 205" />
            <path className="product-fil product-draw product-w4" d="M270 232 C 360 270, 420 180, 530 265 S 690 275, 760 255" />
            <path className="product-fil product-draw product-w5" d="M270 226 C 370 170, 460 300, 560 190 S 700 165, 760 190" />
            <path className="product-fil product-draw product-w6" d="M270 234 C 370 295, 460 165, 560 275 S 700 300, 760 268" />
            <path className="product-fil product-draw product-w7" d="M272 230 C 380 210, 500 250, 580 225 S 700 225, 760 228" />
            <path
              className="product-fil product-draw product-w-active"
              d="M270 230 C 350 185, 430 270, 520 210 S 640 150, 720 132 S 1000 108, 1105 108"
            />
          </g>
          <g className="product-outs">
            <path className="product-fil product-draw" d="M760 205 C 870 175, 990 130, 1105 110" />
            <path className="product-fil product-draw" d="M760 228 C 880 229, 990 230, 1105 230" />
            <path className="product-fil product-draw" d="M760 252 C 870 285, 990 330, 1105 350" />
          </g>
          <g className="product-api-rail" aria-hidden="true">
            <line x1="1145" y1="92" x2="1145" y2="372" className="product-api-rail-line" />
            <line x1="1114" y1="108" x2="1145" y2="108" className="product-api-rail-tick" />
            <line x1="1114" y1="230" x2="1145" y2="230" className="product-api-rail-tick" />
            <line x1="1114" y1="352" x2="1145" y2="352" className="product-api-rail-tick" />
          </g>
          <g>
            <circle cx="1110" cy="108" r="4.5" className="product-end-node product-end-active" />
            <circle cx="1110" cy="230" r="4" className="product-end-node" />
            <circle cx="1110" cy="352" r="4" className="product-end-node" />
          </g>
          <g aria-hidden="true">
            <path className="product-reg" d="M60 60 h16 M68 52 v16" />
            <path className="product-reg" d="M1340 420 h16 M1348 412 v16" />
          </g>
          <text x="30" y="270" className="product-slbl">
            {t('product.hero.inLabel')}
          </text>
          <text x="470" y="345" className="product-slbl">
            {t('product.hero.bandLabel')}
          </text>
        </svg>

        {/* Mobile/tablet vertical variant — same figureAlt story, top-to-bottom */}
        <svg
          className="product-herosvg-m w-full h-auto"
          viewBox="0 0 393 470"
          aria-hidden="true"
          focusable="false"
        >
          <path className="product-fil product-f-in" d="M24 44 q10 -24 20 0 t20 0 t20 0 t20 0 t20 0" />
          <text x="24" y="20" className="product-slbl" style={{ fontSize: 10 }}>
            {t('product.hero.inLabel')}
          </text>
          <g>
            <path className="product-fil product-w1" d="M124 44 C 150 74, 60 104, 96 144 S 120 184, 84 209" />
            <path className="product-fil product-w2" d="M124 44 C 96 82, 132 112, 84 152 S 60 190, 76 209" />
            <path className="product-fil product-w3" d="M124 46 C 132 90, 72 116, 104 158 S 96 194, 80 207" />
            <path className="product-fil product-w4" d="M124 42 C 108 70, 96 124, 66 154 S 88 196, 72 208" />
            <path className="product-fil product-w5" d="M124 45 C 142 96, 84 100, 112 164 S 104 200, 86 210" />
            <path className="product-fil product-w6" d="M124 43 C 88 64, 116 136, 74 166 S 68 200, 78 210" />
            <path className="product-fil product-w7" d="M124 44 C 116 88, 92 128, 88 168 S 82 196, 80 209" />
            <path
              className="product-fil product-w-active dashflow"
              d="M124 44 C 136 92, 76 122, 96 162 C 104 180, 84 198, 70 214 C 60 224, 50 230, 44 240"
            />
          </g>
          <text x="150" y="130" className="product-slbl" style={{ fontSize: 10 }}>
            {t('product.hero.bandLabel')}
          </text>
          <g className="product-outs">
            <path className="product-fil" d="M78 210 C 66 218, 54 228, 44 240" />
            <path className="product-fil" d="M80 210 C 64 218, 54 226, 53 246 C 52 274, 46 292, 44 306" />
            <path className="product-fil" d="M82 210 C 60 220, 50 228, 48 248 C 46 296, 44 334, 44 372" />
          </g>
          <g aria-hidden="true">
            <line x1="30" y1="240" x2="30" y2="428" className="product-api-rail-line" />
            <line x1="30" y1="240" x2="38" y2="240" className="product-api-rail-tick" />
            <line x1="30" y1="306" x2="38" y2="306" className="product-api-rail-tick" />
            <line x1="30" y1="372" x2="38" y2="372" className="product-api-rail-tick" />
            <line x1="30" y1="428" x2="44" y2="428" className="product-api-rail-tick" />
          </g>
          <circle cx="44" cy="240" r="10" fill="rgba(238,74,38,.16)" className="glowp" />
          <circle cx="44" cy="240" r="4.5" className="product-end-node product-end-active pulse" />
          <circle cx="44" cy="306" r="4" className="product-end-node" />
          <circle cx="44" cy="372" r="4" className="product-end-node" />
          <text x="64" y="244" style={labelNameStyle}>
            {t('product.hero.ep1')}
          </text>
          <text x="64" y="260" style={labelStatusStyle}>
            {t('product.hero.ep1s')}
          </text>
          <text x="64" y="310" style={labelNameStyle}>
            {t('product.hero.ep2')}
          </text>
          <text x="64" y="326" style={labelStatusStyle}>
            {t('product.hero.ep2s')}
          </text>
          <text x="64" y="376" style={labelNameStyle}>
            {t('product.hero.ep3')}
          </text>
          <text x="64" y="392" style={labelStatusStyle}>
            {t('product.hero.ep3s')}
          </text>
          <text x="64" y="432" style={apiTitleStyle}>
            {t('product.hero.ep4')}
          </text>
          <text x="64" y="448" style={apiStatusStyle}>
            {t('product.hero.ep4s')}
          </text>
          <g aria-hidden="true">
            <path className="product-reg" d="M352 36 h16 M360 28 v16" />
            <path className="product-reg" d="M24 452 h16 M32 444 v16" />
          </g>
        </svg>

        <ul className="product-hero-labels-overlay list-none m-0 p-0">
          {ENDPOINTS.map(({ id, labelKey, statusKey, y }) => (
            <li
              key={id}
              className="product-hero-label-item"
              style={{ '--hero-label-y': y } as React.CSSProperties}
            >
              <button type="button" onClick={() => scrollTo(id)} className="product-end-label-btn">
                {t(`product.hero.${labelKey}`)}
              </button>
              <span className="product-end-label-status">{t(`product.hero.${statusKey}`)}</span>
            </li>
          ))}
        </ul>

        <div className="product-hero-api-label">
          <span className="product-api-rail-label-title">{t('product.hero.ep4')}</span>
          <span className="product-api-rail-label-status">{t('product.hero.ep4s')}</span>
        </div>
      </figure>
    </section>
  );
}
