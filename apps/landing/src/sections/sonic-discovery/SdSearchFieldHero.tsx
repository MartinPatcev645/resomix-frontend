import { useTranslation } from 'react-i18next';
import { BASE_BETA_URL } from '@resomix/config';
import { SdScene1Figure } from '@/sections/sonic-discovery/scenes/SdScene1Figure.tsx';
import { HeroTitle } from '@/components/HeroTitle.tsx';

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

export function SdSearchFieldHero({ motionOn, onScrollToConsole }: SdSearchFieldHeroProps) {
  const { t } = useTranslation('common');

  return (
    <section id="sd-hero" className="sd-section rx-hero-pad" aria-label="Sonic Discovery introduction">
      <div className="sd-col">
        <div className="sd-hero-head">
          <p className="sd-eyebrow uppercase">{renderEyebrow(t('sonicDiscovery.hero.eyebrow'))}</p>
          {/* Mobile (<768px) uses the shared landing hero size var(--px-32)/1.06 +
              max-w-[18ch] — same as the other landing heroes, do not re-bespoke it.
              md: restores the previous var(--px-38)/1.04 so 768px+ is unchanged. */}
          <h1 className="font-benzin uppercase font-black text-[length:var(--px-32)] leading-[1.06] max-w-[18ch] md:max-w-none md:text-[length:var(--px-36)] lg:text-[length:var(--px-48)] m-0 mb-[var(--px-24)]">
            <HeroTitle text={t('sonicDiscovery.hero.title')} emClass="sd-em" />
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
      </div>

      <SdScene1Figure motionOn={motionOn} />
    </section>
  );
}
