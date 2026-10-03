import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

export function RlMetadata() {
  const { t } = useTranslation('common');

  return (
    <section className="rl-section" id="rl-metadata">
      <div className="rl-frame">
        <div className="rl-meta-grid">
          <div>
            <p className="rl-eyebrow uppercase">{t('recordLabels.metadata.eyebrow')}</p>
            <h2 className="rl-h2b uppercase">{t('recordLabels.metadata.h2')}</h2>
            <p className="rl-body">{t('recordLabels.metadata.p1')}</p>
            <p className="rl-body">{t('recordLabels.metadata.p2')}</p>
            <p className="rl-body rl-body-emph"><Trans i18nKey="recordLabels.metadata.p3" components={{ a: <a href={BLOG.beyondTags} /> }} /></p>
          </div>

          <figure
            className="rl-fig"
            role="img"
            aria-label={t('recordLabels.metadata.figureAria')}
          >
            {/* Illustrative — fictional catalogue rows / field points. */}
            <svg className="rl-sl rl-fig-d" viewBox="0 0 640 380" aria-hidden="true">
              <text x="36" y="40" fontSize="11">
                {t('recordLabels.figures.metadataView')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.22)' }}>
                <rect x="36" y="56" width="250" height="26" />
                <rect x="36" y="90" width="250" height="26" />
                <rect x="36" y="124" width="250" height="26" />
                <rect x="36" y="158" width="250" height="26" />
                <rect x="36" y="192" width="250" height="26" />
                <rect x="36" y="226" width="250" height="26" />
                <rect x="36" y="260" width="250" height="26" />
                <rect x="36" y="294" width="250" height="26" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.14)' }}>
                <line x1="120" y1="56" x2="120" y2="320" />
                <line x1="205" y1="56" x2="205" y2="320" />
              </g>
              <g fontSize="8.5" style={{ fill: '#6a6a6a' }}>
                <text x="44" y="73">
                  Title
                </text>
                <text x="128" y="73">
                  Year
                </text>
                <text x="213" y="73">
                  Genre
                </text>
              </g>
              <rect x="36" y="226" width="250" height="26" style={{ color: 'rgba(255,255,255,.32)' }} />
              <line
                x1="320"
                y1="40"
                x2="320"
                y2="340"
                strokeDasharray="2 6"
                style={{ color: 'rgba(255,255,255,.14)' }}
              />
              <text x="352" y="40" fontSize="11">
                {t('recordLabels.figures.sonicView')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.32)' }}>
                <circle cx="396" cy="96" r="2.6" />
                <circle cx="420" cy="80" r="2.6" />
                <circle cx="438" cy="104" r="2.6" />
                <circle cx="410" cy="122" r="2.6" />
                <circle cx="452" cy="86" r="2.6" />
                <circle cx="520" cy="140" r="2.6" />
                <circle cx="544" cy="126" r="2.6" />
                <circle cx="536" cy="158" r="2.6" />
                <circle cx="560" cy="146" r="2.6" />
                <circle cx="420" cy="220" r="2.6" />
                <circle cx="444" cy="238" r="2.6" />
                <circle cx="428" cy="258" r="2.6" />
                <circle cx="464" cy="226" r="2.6" />
                <circle cx="540" cy="270" r="2.6" />
                <circle cx="562" cy="288" r="2.6" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.1)' }}>
                <path d="M420 80 L452 86 M438 104 L410 122 M520 140 L544 126 M444 238 L464 226" />
              </g>
              <circle className="rl-glowp" cx="500" cy="204" r="5" style={{ fill: '#EE4A26', stroke: 'none' }} />
              <circle cx="500" cy="204" r="11" style={{ color: 'rgba(238,74,38,.35)' }} />
              <g style={{ color: 'rgba(238,74,38,.45)' }}>
                <path className="rl-dashflow" d="M500 204 C 510 180 516 160 528 150" />
                <path className="rl-dashflow" d="M500 204 C 486 214 470 220 458 224" />
              </g>
              <text x="462" y="188" fontSize="10.5" style={{ fill: '#EE4A26' }}>
                {t('recordLabels.figures.forgottenFound')}
              </text>
              <path
                d="M286 239 C 330 239 400 216 489 205"
                strokeDasharray="3 5"
                style={{ color: 'rgba(238,74,38,.35)' }}
              />
            </svg>

            <svg className="rl-sl rl-fig-m" viewBox="0 0 393 420" aria-hidden="true">
              <text x="24" y="34" fontSize="11">
                {t('recordLabels.figures.metadataView')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.22)' }}>
                <rect x="24" y="48" width="345" height="24" />
                <rect x="24" y="80" width="345" height="24" />
                <rect x="24" y="112" width="345" height="24" />
                <rect x="24" y="144" width="345" height="24" />
              </g>
              <rect x="24" y="112" width="345" height="24" style={{ color: 'rgba(255,255,255,.32)' }} />
              <line
                x1="24"
                y1="196"
                x2="369"
                y2="196"
                strokeDasharray="2 6"
                style={{ color: 'rgba(255,255,255,.14)' }}
              />
              <text x="24" y="226" fontSize="11">
                {t('recordLabels.figures.sonicView')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.32)' }}>
                <circle cx="70" cy="270" r="2.6" />
                <circle cx="94" cy="256" r="2.6" />
                <circle cx="110" cy="280" r="2.6" />
                <circle cx="84" cy="296" r="2.6" />
                <circle cx="200" cy="300" r="2.6" />
                <circle cx="222" cy="286" r="2.6" />
                <circle cx="214" cy="318" r="2.6" />
                <circle cx="300" cy="264" r="2.6" />
                <circle cx="322" cy="280" r="2.6" />
                <circle cx="310" cy="300" r="2.6" />
              </g>
              <circle className="rl-glowp" cx="256" cy="350" r="5" style={{ fill: '#EE4A26', stroke: 'none' }} />
              <circle cx="256" cy="350" r="10" style={{ color: 'rgba(238,74,38,.35)' }} />
              <g style={{ color: 'rgba(238,74,38,.45)' }}>
                <path className="rl-dashflow" d="M256 350 C 240 330 224 318 214 318" />
                <path className="rl-dashflow" d="M256 350 C 276 330 296 310 310 300" />
              </g>
              <text x="200" y="388" fontSize="11" style={{ fill: '#EE4A26' }}>
                {t('recordLabels.figures.forgottenFound')}
              </text>
            </svg>

            <figcaption>
              <span>{t('recordLabels.figures.sameCatalogue')}</span>
              <span>{t('recordLabels.figures.twoWays')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
