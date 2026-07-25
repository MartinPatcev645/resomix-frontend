import { useTranslation } from 'react-i18next';

const ROUTES = [
  { whoKey: 'r1who' as const, whatKey: 'r1what' as const },
  { whoKey: 'r2who' as const, whatKey: 'r2what' as const },
  { whoKey: 'r3who' as const, whatKey: 'r3what' as const },
  { whoKey: 'r4who' as const, whatKey: 'r4what' as const },
  { whoKey: 'r5who' as const, whatKey: 'r5what' as const },
];

export function AudienceRouter() {
  const { t } = useTranslation('common');

  return (
    <section id="router" aria-label="Find your path">
      <header className="product-router-head">
        <h2 className="m-0 font-helvetica uppercase font-medium text-[length:var(--px-52)] leading-[var(--px-60)] text-[var(--color-primary)]">
          {t('product.router.title')}
        </h2>
      </header>
      <ul className="product-route-list">
        {ROUTES.map(({ whoKey, whatKey }) => (
          <li key={whoKey} className="product-route-row">
            {/* TODO(wave-2/3): link to /solutions/… when the page ships */}
            <span className="product-route-who">{t(`product.router.${whoKey}`)}</span>
            <span className="product-route-what font-helvetica">{t(`product.router.${whatKey}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
