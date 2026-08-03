import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HeroTitle } from '@/components/HeroTitle.tsx';

export function MlHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="ml-hero ml-section rx-hero-pad" id="ml-hero">
      <div className="ml-frame">
        <p className="ml-beta">
          <i aria-hidden="true" />
          {t('musicLibraries.hero.chip')}
        </p>
        <h1 className="ml-benzin uppercase"><HeroTitle text={t('musicLibraries.hero.h1')} emClass="ml-em" /></h1>
        <p className="ml-intro">{t('musicLibraries.hero.intro')}</p>
        <div className="ml-ctas">
          <button
            type="button"
            className="ml-cta-p uppercase"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('musicLibraries.cta.pilot')}
          </button>
          <button
            type="button"
            className="ml-cta-s uppercase"
            onClick={() => navigate('/developers')}
          >
            {t('musicLibraries.cta.exploreApi')}
          </button>
        </div>
      </div>

      {/* Illustrative — fictional sample wall; one reference, threads to relatives across packs. */}
      <div
        className="ml-hero-art"
        role="img"
        aria-label={t('musicLibraries.hero.figureAria')}
      >
        <div className="ml-hero-glow" aria-hidden="true" />
        {/* Desktop: preview geometry; viewBox width-tight so art scales large by design. */}
        <svg className="ml-sl ml-hero-d" viewBox="0 0 1240 250" aria-hidden="true">
          <g style={{ color: 'rgba(255,255,255,.22)' }}>
            <rect x="60" y="40" width="44" height="44" />
            <rect x="112" y="40" width="44" height="44" />
            <rect x="164" y="40" width="44" height="44" />
            <rect x="216" y="40" width="44" height="44" />
            <rect x="60" y="92" width="44" height="44" />
            <rect x="164" y="92" width="44" height="44" />
            <rect x="216" y="92" width="44" height="44" />
            <rect x="60" y="144" width="44" height="44" />
            <rect x="112" y="144" width="44" height="44" />
            <rect x="164" y="144" width="44" height="44" />
            <rect x="216" y="144" width="44" height="44" />
          </g>
          <rect
            x="112"
            y="92"
            width="44"
            height="44"
            style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.6 }}
          />
          <g style={{ color: 'rgba(255,255,255,.7)' }}>
            <path
              d="M120 114 l5-5 4 8 5-11 5 13 4-9 4 5 3-3"
              style={{ strokeWidth: 1.3 }}
            />
          </g>
          <circle
            className="ml-pulse"
            cx="134"
            cy="114"
            r="2.5"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text
            x="134"
            y="212"
            textAnchor="middle"
            style={{ fontSize: '11px', fill: '#d8d8d8' }}
          >
            {t('musicLibraries.figures.yourReference')}
          </text>
          <g style={{ color: 'rgba(255,255,255,.16)' }}>
            <rect x="420" y="52" width="38" height="38" />
            <rect x="466" y="52" width="38" height="38" />
            <rect x="512" y="52" width="38" height="38" />
            <rect x="420" y="98" width="38" height="38" />
            <rect x="512" y="98" width="38" height="38" />
            <rect x="420" y="144" width="38" height="38" />
            <rect x="466" y="144" width="38" height="38" />
          </g>
          <g style={{ color: 'rgba(255,255,255,.16)' }}>
            <rect x="700" y="64" width="38" height="38" />
            <rect x="746" y="64" width="38" height="38" />
            <rect x="792" y="64" width="38" height="38" />
            <rect x="700" y="110" width="38" height="38" />
            <rect x="746" y="110" width="38" height="38" />
            <rect x="746" y="156" width="38" height="38" />
          </g>
          <g style={{ color: 'rgba(255,255,255,.16)' }}>
            <rect x="980" y="48" width="38" height="38" />
            <rect x="1026" y="48" width="38" height="38" />
            <rect x="1072" y="48" width="38" height="38" />
            <rect x="1118" y="48" width="38" height="38" />
            <rect x="980" y="94" width="38" height="38" />
            <rect x="1072" y="94" width="38" height="38" />
            <rect x="980" y="140" width="38" height="38" />
            <rect x="1026" y="140" width="38" height="38" />
            <rect x="1118" y="140" width="38" height="38" />
          </g>
          <g style={{ fill: '#9c9c9c' }}>
            <text x="160" y="26" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              {t('musicLibraries.figures.packDrums')}
            </text>
            <text x="485" y="38" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              {t('musicLibraries.figures.packSynths')}
            </text>
            <text x="765" y="50" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              {t('musicLibraries.figures.packVocals')}
            </text>
            <text x="1064" y="34" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              {t('musicLibraries.figures.packTextures')}
            </text>
          </g>
          <g style={{ color: 'rgba(238,74,38,.55)' }}>
            <path
              className="ml-dashflow"
              d="M156 114 C 280 114 340 118 466 117"
            />
            <path
              className="ml-dashflow"
              d="M156 114 C 340 100 560 84 746 84"
            />
            <path
              className="ml-dashflow"
              d="M156 114 C 420 170 760 176 1026 159"
            />
          </g>
          <rect
            x="466"
            y="98"
            width="38"
            height="38"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
          />
          <rect
            x="746"
            y="64"
            width="38"
            height="38"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
          />
          <rect
            x="1026"
            y="140"
            width="38"
            height="38"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
          />
          <circle
            className="ml-glowp"
            cx="1045"
            cy="159"
            r="3"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
        </svg>

        <svg className="ml-sl ml-hero-m" viewBox="0 0 393 330" aria-hidden="true">
          <g style={{ color: 'rgba(255,255,255,.22)' }}>
            <rect x="24" y="34" width="36" height="36" />
            <rect x="68" y="34" width="36" height="36" />
            <rect x="156" y="34" width="36" height="36" />
          </g>
          <rect
            x="112"
            y="34"
            width="36"
            height="36"
            style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.6 }}
          />
          <g style={{ color: 'rgba(255,255,255,.7)' }}>
            <path
              d="M119 52 l4-4 3 7 4-9 4 10 3-7 3 4"
              style={{ strokeWidth: 1.2 }}
            />
          </g>
          <circle
            className="ml-pulse"
            cx="130"
            cy="52"
            r="2.5"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text
            x="130"
            y="94"
            textAnchor="middle"
            style={{ fontSize: '11px', fill: '#d8d8d8' }}
          >
            {t('musicLibraries.figures.yourReference')}
          </text>
          <text x="42" y="26" style={{ fontSize: '10px' }}>
            {t('musicLibraries.figures.packDrums')}
          </text>
          <g style={{ color: 'rgba(255,255,255,.16)' }}>
            <rect x="24" y="130" width="32" height="32" />
            <rect x="64" y="130" width="32" height="32" />
            <rect x="144" y="130" width="32" height="32" />
            <rect x="184" y="130" width="32" height="32" />
            <rect x="24" y="220" width="32" height="32" />
            <rect x="104" y="220" width="32" height="32" />
            <rect x="144" y="220" width="32" height="32" />
            <rect x="224" y="220" width="32" height="32" />
          </g>
          <text x="24" y="122" style={{ fontSize: '10px' }}>
            {t('musicLibraries.figures.packSynths')}
          </text>
          <text x="24" y="212" style={{ fontSize: '10px' }}>
            {t('musicLibraries.figures.packTextures')}
          </text>
          <g style={{ color: 'rgba(238,74,38,.55)' }}>
            <path
              className="ml-dashflow"
              d="M130 70 C 130 100 112 116 110 130"
            />
            <path
              className="ml-dashflow"
              d="M130 70 C 130 150 180 190 196 220"
            />
          </g>
          <rect
            x="104"
            y="130"
            width="32"
            height="32"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
          />
          <rect
            x="184"
            y="220"
            width="32"
            height="32"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
          />
          <circle
            className="ml-glowp"
            cx="200"
            cy="236"
            r="3"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text
            x="252"
            y="300"
            textAnchor="middle"
            style={{ fontSize: '10.5px', fill: '#EE4A26' }}
          >
            {t('musicLibraries.figures.sonicRelatives')}
          </text>
        </svg>
      </div>

      <div className="ml-frame">
        <div className="ml-hero-caps" aria-hidden="true">
          <span>{t('musicLibraries.figures.oneSoundYouLike')}</span>
          <span />
          <span>{t('musicLibraries.figures.itsRelatives')}</span>
        </div>
      </div>
    </section>
  );
}
