import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';
import { useAbDefs } from './abDefs.ts';
import { HeroTitle } from '@/components/HeroTitle.tsx';

/* S1 · Hero — geometry transplanted verbatim from the approved preview
   (`#ab-s1`); shared defs live in AbSharedDefs. */
export function AbHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = useAbDefs();
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-hero ab-section rx-hero-pad" id="ab-s1">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.hero.eyebrow')}</div>
        <h1 className="ab-h1">
          <HeroTitle text={t('about.hero.title')} emClass="ab-em" />
        </h1>
        <p className="ab-lead">{t('about.hero.lead')}</p>
        <p className="ab-support">{t('about.hero.support')}</p>
        <div className="ab-cta-row">
          <button
            type="button"
            className="ab-btn ab-primary"
            onClick={() => navigate('/product')}
          >
            {t('about.hero.ctaPrimary')}
          </button>
          <button
            type="button"
            className="ab-btn"
            onClick={() => {
              window.location.href = BASE_BETA_URL;
            }}
          >
            {t('about.hero.ctaSecondary')}
          </button>
        </div>
        <div className="ab-status-rail">{t('about.hero.status')}</div>
      </div>

      <div className="ab-wrap ab-bleed" style={{ paddingTop: '2.2rem' }}>
        <div className="ab-stagebox">
          <div className="ab-grain" aria-hidden="true" />

          {/* ============ HERO SIGNAL · DESKTOP ============ */}
          <svg className="ab-d-only" viewBox="0 0 1200 430" role="img" aria-label={t('about.hero.figureAriaD')}>
            <g className="ab-plx" data-plx="0.3" fontSize="9" letterSpacing="1.5" fill="rgba(185,185,185,.4)">
              <rect x="160" y="70" width="104" height="24" fill="none" stroke="rgba(255,255,255,.1)" />
              <text x="174" y="86">{f('genre')}</text>
              <rect x="300" y="128" width="140" height="24" fill="none" stroke="rgba(255,255,255,.1)" />
              <text x="314" y="144">{f('releaseYear')}</text>
              <rect x="204" y="186" width="128" height="24" fill="none" stroke="rgba(255,255,255,.1)" />
              <text x="218" y="202">{f('popularity')}</text>
            </g>
            <text x="160" y="52" fontSize="9" letterSpacing="1.6" fill="rgba(185,185,185,.55)">
              {f('usefulContextNotWholeStory')}
            </text>

            <g>
              <circle cx="90" cy="330" r="26" fill={url('halo')} />
              <rect x="77" y="323" width="26" height="15" fill="#EE4A26" />
              <line x1="82" y1="330" x2="98" y2="330" stroke="#101010" />
              <text x="60" y="376" fontSize="10" letterSpacing="1.6" fill="rgba(255,255,255,.94)">
                {f('oneRecording')}
              </text>
            </g>
            <path className="ab-sig" d="M 104 326 C 220 300, 330 276, 452 250" fill="none" stroke="#EE4A26" />

            <g className="ab-plx" data-plx="0.12">
              <circle
                cx="510"
                cy="238"
                r="52"
                fill="none"
                stroke="rgba(255,255,255,.5)"
                strokeDasharray="205 122"
                transform="rotate(150 510 238)"
              />
              <circle
                cx="510"
                cy="238"
                r="70"
                fill="none"
                stroke="rgba(255,255,255,.14)"
                strokeDasharray="90 350"
                transform="rotate(-40 510 238)"
              />
              <rect
                x="504"
                y="232"
                width="12"
                height="12"
                fill="#0C0C0D"
                stroke="rgba(238,74,38,.85)"
                transform="rotate(45 510 238)"
                className="ab-breathe"
              />
              <text x="510" y="164" fontSize="11" letterSpacing="3" textAnchor="middle" fill="rgba(255,255,255,.96)">
                {f('pyxis')}
              </text>
            </g>

            <path className="ab-sig" d="M 566 226 C 640 210, 700 200, 762 194" fill="none" stroke="#EE4A26" />
            <path d="M 560 206 C 700 178, 850 170, 1000 170" fill="none" stroke="rgba(255,255,255,.34)" />
            <path d="M 556 250 C 720 268, 900 264, 1066 260" fill="none" stroke="rgba(255,255,255,.34)" />
            <g className="ab-resolve d1">
              <rect x="768" y="168" width="140" height="40" fill="#17171A" stroke="rgba(255,255,255,.36)" />
              <text x="838" y="186" fontSize="9.5" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.96)">
                <tspan fill="#EE4A26">01 · </tspan>DISCOVER
              </text>
              <text x="838" y="200" fontSize="9.5" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.96)">
                {f('relationships')}
              </text>
            </g>
            <g className="ab-resolve d2">
              <rect x="1004" y="150" width="112" height="40" fill="#17171A" stroke="rgba(255,255,255,.32)" />
              <text x="1060" y="168" fontSize="9.5" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.94)">
                <tspan fill="#EE4A26">02 · </tspan>READ THE
              </text>
              <text x="1060" y="182" fontSize="9.5" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.94)">
                {f('recording')}
              </text>
            </g>
            <g className="ab-resolve d3">
              <rect x="1066" y="240" width="118" height="40" fill="#17171A" stroke="rgba(255,255,255,.32)" />
              <text x="1125" y="258" fontSize="9.5" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.94)">
                <tspan fill="#EE4A26">03 · </tspan>SEARCH A
              </text>
              <text x="1125" y="272" fontSize="9.5" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,.94)">
                {f('catalogue')}
              </text>
            </g>
            <text x="600" y="398" fontSize="10" letterSpacing="2" textAnchor="middle" fill="rgba(185,185,185,.92)">
              {f('threeDistinctProductsOneSharedEngine')}
            </text>
            <g stroke="rgba(255,255,255,.06)">
              <line x1="40" y1="414" x2="1160" y2="414" />
            </g>
            <text x="40" y="428" fontSize="8" letterSpacing="1.5" fill="rgba(185,185,185,.35)">
              {f('coordinates')}
            </text>
          </svg>

          {/* ============ HERO SIGNAL · MOBILE ============ */}
          <svg className="ab-m-only" viewBox="0 0 390 528" role="img" aria-label={t('about.hero.figureAriaM')}>
            <circle cx="60" cy="50" r="20" fill={url('halo')} />
            <rect x="49" y="44" width="22" height="13" fill="#EE4A26" />
            <text x="84" y="54" fontSize="12.5" letterSpacing="1" fill="rgba(255,255,255,.94)">
              {f('oneRecording')}
            </text>
            <path className="ab-sig" d="M 60 66 V 108" fill="none" stroke="#EE4A26" />
            <g fontSize="12.3" letterSpacing="1" fill="rgba(185,185,185,.4)">
              <rect x="220" y="40" width="146" height="26" fill="none" stroke="rgba(255,255,255,.1)" />
              <text x="232" y="57">{f('releaseYear')}</text>
              <rect x="240" y="76" width="126" height="26" fill="none" stroke="rgba(255,255,255,.1)" />
              <text x="252" y="93">{f('popularity')}</text>
            </g>
            <circle
              cx="60"
              cy="146"
              r="30"
              fill="none"
              stroke="rgba(255,255,255,.5)"
              strokeDasharray="118 70"
              transform="rotate(150 60 146)"
            />
            <rect
              x="55"
              y="141"
              width="10"
              height="10"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 60 146)"
            />
            <text x="104" y="152" fontSize="13" letterSpacing="2" fill="rgba(255,255,255,.96)">
              {f('pyxis')}
            </text>
            <path className="ab-sig" d="M 60 178 V 216" fill="none" stroke="#EE4A26" />
            <g className="ab-resolve d1">
              <rect x="52" y="224" width="314" height="52" fill="#17171A" stroke="rgba(255,255,255,.36)" />
              <text x="68" y="255" fontSize="12.5" letterSpacing="1" fill="rgba(255,255,255,.94)">
                <tspan fill="#EE4A26">01 · </tspan>DISCOVER RELATIONSHIPS
              </text>
            </g>
            <path
              d="M 36 196 V 418 M 36 250 H 52 M 36 334 H 52 M 36 418 H 52"
              fill="none"
              stroke="rgba(255,255,255,.34)"
            />
            <g className="ab-resolve d2">
              <rect x="52" y="308" width="314" height="52" fill="#17171A" stroke="rgba(255,255,255,.32)" />
              <text x="68" y="339" fontSize="12.5" letterSpacing="1" fill="rgba(255,255,255,.9)">
                <tspan fill="#EE4A26">02 · </tspan>READ THE RECORDING
              </text>
            </g>
            <g className="ab-resolve d3">
              <rect x="52" y="392" width="314" height="52" fill="#17171A" stroke="rgba(255,255,255,.32)" />
              <text x="68" y="423" fontSize="12.5" letterSpacing="1" fill="rgba(255,255,255,.9)">
                <tspan fill="#EE4A26">03 · </tspan>SEARCH A CATALOGUE
              </text>
            </g>
            <text x="24" y="470" fontSize="12.3" letterSpacing="1.2" fill="rgba(185,185,185,.92)">
              {f('threeDistinctProductsM')}
            </text>
            <text x="24" y="488" fontSize="12.3" letterSpacing="1.2" fill="rgba(185,185,185,.92)">
              {f('oneSharedEngineM')}
            </text>
            <text x="24" y="516" fontSize="12.3" letterSpacing="1.2" fill="rgba(185,185,185,.35)">
              {f('coordinates')}
            </text>
          </svg>
        </div>
        <div className="ab-fig-caption">
          <span>{t('about.hero.captionA')}</span>
          <span>{t('about.hero.captionB')}</span>
        </div>
      </div>
    </section>
  );
}
