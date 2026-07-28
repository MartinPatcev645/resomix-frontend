import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface BracketLinkProps {
  text: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}

function BracketLink({ text, href, external, onClick }: BracketLinkProps) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="product-bracket-link">
        {text}
      </button>
    );
  }
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="product-bracket-link"
    >
      {text}
    </a>
  );
}

export function PlatformOverview() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const pillars = [
    {
      tag: t('product.overview.p1tag'),
      title: t('product.overview.p1title'),
      desc: t('product.overview.p1desc'),
      status: t('product.overview.p1status'),
      link: t('product.overview.p1link'),
      onClick: () => navigate('/product/sonic-discovery'),
    },
    {
      tag: t('product.overview.p2tag'),
      title: t('product.overview.p2title'),
      desc: t('product.overview.p2desc'),
      status: t('product.overview.p2status'),
      link: t('product.overview.p2link'),
      onClick: () => navigate('/product/track-intelligence'),
    },
    {
      tag: t('product.overview.p3tag'),
      title: t('product.overview.p3title'),
      desc: t('product.overview.p3desc'),
      status: t('product.overview.p3status'),
      link: t('product.overview.p3link'),
      onClick: () => navigate('/product/catalog-intelligence'),
    },
  ];

  return (
    <section id="overview" aria-label="The three products and the API path">
      <header className="product-sec-head">
        <h2 className="m-0 font-helvetica uppercase font-medium text-[length:var(--px-52)] leading-[var(--px-60)] text-[var(--color-primary)]">
          {t('product.overview.title')}
        </h2>
        <p className="m-0 font-helvetica font-light text-[length:var(--px-17)] opacity-70 leading-[var(--px-24)]">
          {t('product.overview.sub')}
        </p>
      </header>
      <div className="product-pillar-grid">
        {pillars.map((p) => (
          <article key={p.tag} className="product-pillar-cell">
            <p className="product-microtag product-microtag-orange m-0">{p.tag}</p>
            <h3 className="m-0 text-[length:var(--px-20)] tracking-[0.01em] font-helvetica text-[var(--color-primary)]">
              {p.title}
            </h3>
            <p className="product-pillar-desc font-helvetica">{p.desc}</p>
            <p className="product-pillar-status m-0">{p.status}</p>
            <BracketLink text={p.link} href={'href' in p ? (p as { href?: string }).href : undefined} onClick={'onClick' in p ? p.onClick : undefined} />
          </article>
        ))}
      </div>
      <div className="product-api-band">
        <p className="product-microtag product-microtag-orange m-0 shrink-0">{t('product.overview.p4tag')}</p>
        <h3 className="m-0 shrink-0 text-[length:var(--px-20)] tracking-[0.01em] font-helvetica text-[var(--color-primary)]">
          {t('product.overview.p4title')}
        </h3>
        <p className="product-api-band-desc m-0 font-helvetica">{t('product.overview.p4desc')}</p>
        <p className="product-api-band-status m-0 shrink-0">{t('product.overview.p4status')}</p>
        <BracketLink text={t('product.overview.p4link')} onClick={() => navigate('/developers')} />
      </div>
    </section>
  );
}
