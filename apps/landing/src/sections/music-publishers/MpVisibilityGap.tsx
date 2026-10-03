import { useTranslation, Trans } from 'react-i18next';
import { useMpDefs } from './mpDefs.ts';
import { BLOG } from '@/routes/blogLinks.ts';

/* S3 · The catalogue visibility gap. */
export function MpVisibilityGap() {
  const { t } = useTranslation('common');
  const { url } = useMpDefs();

  return (
    <section className="mp-sec mp-section" id="mp-s3">
      <div className="mp-wrap">
        <div className="mp-eyebrow">{t('musicPublishers.gap.eyebrow')}</div>
        <h2 className="mp-h2">{t('musicPublishers.gap.h2')}</h2>
        <div className="mp-copycol">
          <p className="mp-body-p">{t('musicPublishers.gap.p1')}</p>
          <p className="mp-body-p">{t('musicPublishers.gap.p2')}</p>
          <p className="mp-body-p"><Trans i18nKey="musicPublishers.gap.p3" components={{ a: <a href={BLOG.beyondTags} /> }} /></p>
        </div>
      </div>

      <div className="mp-wrap mp-bleed mp-fig">
        <div className="mp-stagebox">
          <div className="mp-grain" aria-hidden="true" />

          {/* ============ UNDEREXPOSED MIDDLE · DESKTOP ============ */}
          <svg
            className="mp-d-only"
            viewBox="0 0 1200 340"
            role="img"
            aria-label={t('musicPublishers.gap.figureAriaD')}
          >
            {/* metadata rail (above) */}
            <text x="60" y="34" fontSize="8" letterSpacing="2" fill="rgba(185,185,185,.6)">
              {t('musicPublishers.figures.metadataFields')}
            </text>
            <text x="1140" y="34" fontSize="7" letterSpacing="1.5" textAnchor="end" fill="rgba(185,185,185,.4)">
              {t('musicPublishers.figures.metadataLayer')}
            </text>
            <g stroke="rgba(185,185,185,.28)" fill="none">
              <path d="M 60 48 V 42 M 60 48 H 340 M 340 48 V 42" />
              <path d="M 372 48 V 42 M 372 48 H 828 M 828 48 V 42" />
              <path d="M 860 48 V 42 M 860 48 H 1140 M 1140 48 V 42" />
            </g>

            {/* three zones */}
            <g>
              <rect x="60" y="86" width="280" height="130" fill={url('cellsC')} />
              <rect x="372" y="86" width="456" height="130" fill={url('cellsD')} />
              <rect x="860" y="86" width="280" height="130" fill={url('cellsE')} />
              <rect x="60" y="86" width="280" height="130" fill="none" stroke="rgba(255,255,255,.1)" />
              <rect x="372" y="86" width="456" height="130" fill="none" stroke="rgba(255,255,255,.14)" strokeDasharray="2 5" />
              <rect x="860" y="86" width="280" height="130" fill="none" stroke="rgba(255,255,255,.1)" />
            </g>
            <text x="60" y="240" fontSize="8.5" letterSpacing="1.8" fill="rgba(185,185,185,.65)">
              {t('musicPublishers.figures.established')}
            </text>
            <text x="600" y="240" fontSize="9.5" letterSpacing="2" textAnchor="middle" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.underexposedMiddle')}
            </text>
            <text x="1140" y="240" fontSize="8.5" letterSpacing="1.8" textAnchor="end" fill="rgba(185,185,185,.65)">
              {t('musicPublishers.figures.recentVisible')}
            </text>

            {/* the bypass route: recent reference → sonic layer → underexposed work */}
            <circle cx="990" cy="130" r="16" fill={url('haloA')} />
            <rect x="982" y="125" width="16" height="10" fill="rgba(255,255,255,.95)" />
            <rect x="978" y="121" width="24" height="18" fill="none" stroke="rgba(238,74,38,.8)" />
            <path
              className="sig"
              d="M 990 140 C 990 250, 860 268, 700 272 C 620 274, 570 250, 562 176"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />
            <g className="resolve d2">
              <rect x="552" y="158" width="18" height="11" fill="rgba(255,255,255,.9)" />
              <rect x="548" y="154" width="26" height="19" fill="none" stroke="rgba(238,74,38,.7)" />
            </g>

            {/* sonic layer (below) */}
            <text x="60" y="292" fontSize="8" letterSpacing="2" fill="rgba(255,255,255,.7)">
              {t('musicPublishers.figures.sonicFields')}
            </text>
            <text x="1140" y="292" fontSize="7" letterSpacing="1.5" textAnchor="end" fill="rgba(185,185,185,.4)">
              {t('musicPublishers.figures.sonicLayer')}
            </text>
            <line x1="60" y1="300" x2="1140" y2="300" stroke="rgba(255,255,255,.09)" />

            <text x="600" y="326" fontSize="7.5" letterSpacing="1.4" textAnchor="middle" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.metadataOrganises')}
            </text>
          </svg>

          {/* ============ UNDEREXPOSED MIDDLE · MOBILE ============ */}
          <svg
            className="mp-m-only"
            viewBox="0 0 390 560"
            role="img"
            aria-label={t('musicPublishers.gap.figureAriaM')}
          >
            <text x="24" y="26" fontSize="7.5" letterSpacing="1.5" fill="rgba(185,185,185,.6)">
              {t('musicPublishers.figures.metadataFields')}
            </text>
            <line x1="24" y1="36" x2="366" y2="36" stroke="rgba(185,185,185,.25)" />

            <text x="24" y="66" fontSize="8" letterSpacing="1.5" fill="rgba(185,185,185,.65)">
              {t('musicPublishers.figures.recentVisible')}
            </text>
            <rect x="24" y="76" width="342" height="76" fill={url('cellsE')} />
            <rect x="24" y="76" width="342" height="76" fill="none" stroke="rgba(255,255,255,.1)" />

            <text x="24" y="188" fontSize="8.5" letterSpacing="1.6" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.underexposedMiddle')}
            </text>
            <rect x="24" y="198" width="342" height="150" fill={url('cellsD')} />
            <rect x="24" y="198" width="342" height="150" fill="none" stroke="rgba(255,255,255,.14)" strokeDasharray="2 5" />

            <text x="24" y="384" fontSize="8" letterSpacing="1.5" fill="rgba(185,185,185,.65)">
              {t('musicPublishers.figures.established')}
            </text>
            <rect x="24" y="394" width="342" height="76" fill={url('cellsC')} />
            <rect x="24" y="394" width="342" height="76" fill="none" stroke="rgba(255,255,255,.1)" />

            <rect x="308" y="104" width="16" height="10" fill="rgba(255,255,255,.95)" />
            <rect x="304" y="100" width="24" height="18" fill="none" stroke="rgba(238,74,38,.8)" />
            <path
              className="sig"
              d="M 316 118 C 316 168, 220 180, 176 226 C 154 248, 150 262, 150 272"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />
            <g className="resolve d2">
              <rect x="141" y="274" width="18" height="11" fill="rgba(255,255,255,.9)" />
              <rect x="137" y="270" width="26" height="19" fill="none" stroke="rgba(238,74,38,.7)" />
            </g>

            <text x="24" y="502" fontSize="7.5" letterSpacing="1.4" fill="rgba(255,255,255,.7)">
              {t('musicPublishers.figures.sonicFieldsM1')}
            </text>
            <text x="24" y="516" fontSize="7.5" letterSpacing="1.4" fill="rgba(255,255,255,.7)">
              {t('musicPublishers.figures.sonicFieldsM2')}
            </text>
            <text x="24" y="544" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.metadataOrganisesM1')}
            </text>
            <text x="24" y="556" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.metadataOrganisesM2')}
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
