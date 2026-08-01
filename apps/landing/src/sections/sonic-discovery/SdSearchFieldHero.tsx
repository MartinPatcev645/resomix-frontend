import { useTranslation } from 'react-i18next';
import { BASE_BETA_URL } from '@resomix/config';
import { SdScene1Figure } from '@/sections/sonic-discovery/scenes/SdScene1Figure.tsx';

interface SdSearchFieldHeroProps {
  motionOn: boolean;
  onScrollToConsole: () => void;
}

function renderEyebrow(text: string) {
  const highlight = 'live in beta';
  const idx = text.toLowerCase().indexOf(highlight);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="sd-o">{text.slice(idx, idx + highlight.length)}</span>
      {text.slice(idx + highlight.length)}
    </>
  );
}

function renderTitle(title: string) {
  const dotIdx = title.indexOf('. ');
  if (dotIdx === -1) return title;
  return (
    <>
      {title.slice(0, dotIdx + 1)}
      <br />
      {title.slice(dotIdx + 2)}
    </>
  );
}

export function SdSearchFieldHero({ motionOn, onScrollToConsole }: SdSearchFieldHeroProps) {
  const { t } = useTranslation('common');

  return (
    <section id="sd-hero" className="sd-section" aria-label="Sonic Discovery introduction">
      <div className="sd-hero-head">
        <p className="sd-eyebrow uppercase">{renderEyebrow(t('sonicDiscovery.hero.eyebrow'))}</p>
        <h1 className="font-benzin uppercase text-[length:var(--px-38)] lg:text-[length:var(--px-70)] leading-[1.04] m-0 mb-[var(--px-24)]">
          {renderTitle(t('sonicDiscovery.hero.title'))}
        </h1>
        <p className="sd-body sd-sub">{t('sonicDiscovery.hero.sub')}</p>
        <div className="sd-ctarow">
          <a className="sd-pill sd-pill-solid uppercase" href={BASE_BETA_URL}>
            {t('sonicDiscovery.hero.ctaPrimary')}
          </a>
          <button
            type="button"
            className="sd-pill sd-pill-line uppercase"
            onClick={onScrollToConsole}
          >
            {t('sonicDiscovery.hero.ctaSecondary')}
          </button>
        </div>
      </div>

      <SdScene1Figure motionOn={motionOn} />
    </section>
  );
}
