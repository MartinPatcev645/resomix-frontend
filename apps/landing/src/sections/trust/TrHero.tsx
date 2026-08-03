import { useTranslation } from 'react-i18next';
import { TrStatusChip } from './TrStatusChip.tsx';
import { LEGAL_LIBRARY_URL } from './trData.ts';
import { HeroTitle } from '@/components/HeroTitle.tsx';

export function TrHero() {
  const { t } = useTranslation('common');

  return (
    <section id="hero" aria-label="Trust, Rights and Security" className="tr-section">
      <div className="tr-read tr-hero-read">
        <p className="tr-eyebrow uppercase">{t('trust.hero.eyebrow')}</p>
        {/* Mobile (<768px) base is the shared landing mobile hero size: var(--px-32) / 1.06 / 18ch,
            matching .rl-benzin on the solutions pages. Do not swap it back to a bespoke value.
            md:/lg: keep the tablet + desktop sizes exactly as they were. */}
        <h1 className="font-benzin uppercase text-[length:var(--px-32)] leading-[1.06] max-w-[18ch] md:max-w-none md:text-[length:var(--px-64)] md:leading-[var(--px-68)] lg:text-[length:var(--px-72)] lg:leading-[var(--px-76)] mb-[var(--px-24)]">
          <HeroTitle text={t('trust.hero.title')} emClass="tr-em" />
        </h1>
        <p className="tr-body">{t('trust.hero.body')}</p>
        <div className="tr-ctarow">
          <a
            className="tr-pill tr-pill-solid uppercase"
            href={LEGAL_LIBRARY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t('trust.hero.ctaLegal')} — opens the Resomix legal library`}
          >
            {t('trust.hero.ctaLegal')}
          </a>
          <a className="tr-pill tr-pill-line uppercase" href="#contact-block">
            {t('trust.hero.ctaPartnerships')}
          </a>
        </div>
        <p className="tr-trustline uppercase">{t('trust.hero.trustline')}</p>
        <p className="tr-docref uppercase">{t('trust.hero.sourceNote')}</p>
      </div>
      <hr className="tr-hero-rule" aria-hidden="true" />
      <p className="tr-docref tr-hero-docref uppercase">{t('trust.hero.sourceNote')}</p>
      <div className="tr-legend" role="region" aria-label="Status label definitions">
        <span className="tr-lbl uppercase">{t('trust.hero.legendTitle')}</span>
        <dl>
          <dt>
            <TrStatusChip status="current" />
          </dt>
          <dd>{t('trust.hero.legend.current')}</dd>
          <dt>
            <TrStatusChip status="agreementBound" />
          </dt>
          <dd>{t('trust.hero.legend.agreementBound')}</dd>
          <dt>
            <TrStatusChip status="betaControl" />
          </dt>
          <dd>{t('trust.hero.legend.betaControl')}</dd>
          <dt>
            <TrStatusChip status="roadmap" />
          </dt>
          <dd>{t('trust.hero.legend.roadmap')}</dd>
          <dt>
            <TrStatusChip status="notClaimed" />
          </dt>
          <dd>{t('trust.hero.legend.notClaimed')}</dd>
        </dl>
      </div>
    </section>
  );
}
