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
        <svg viewBox="0 0 1400 460" role="img" className="w-full h-auto block">
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
