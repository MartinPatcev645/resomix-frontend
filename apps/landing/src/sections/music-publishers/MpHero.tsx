import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMpDefs } from './mpDefs.ts';
import { HeroTitle } from '@/components/HeroTitle.tsx';

/* S1 · Hero — The Living Asset. Geometry transplanted verbatim from the
   approved preview; shared defs live in MpSharedDefs. */
export function MpHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = useMpDefs();

  return (
    <section className="mp-hero mp-section rx-hero-pad" id="mp-s1">
      <div className="mp-wrap">
        <div className="mp-eyebrow">{t('musicPublishers.hero.eyebrow')}</div>
        <h1 className="mp-h1">
          <HeroTitle text={t('musicPublishers.hero.title')} emClass="mp-em" />
        </h1>
        <p className="mp-body-p">{t('musicPublishers.hero.body')}</p>
        <div className="mp-cta-row">
          <button
            type="button"
            className="mp-btn mp-primary"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('musicPublishers.cta.pilot')}
          </button>
          <button
            type="button"
            className="mp-btn"
            onClick={() => navigate('/product/catalog-intelligence')}
          >
            {t('musicPublishers.cta.exploreCi')}
          </button>
          <span className="mp-cta-status">{t('musicPublishers.hero.status')}</span>
        </div>
      </div>

      <div className="mp-wrap mp-bleed mp-hero-fig">
        <div className="mp-stagebox">
          <div className="mp-grain" aria-hidden="true" />

          {/* ================= HERO · DESKTOP ================= */}
          <svg
            className="mp-d-only"
            viewBox="0 0 1200 440"
            role="img"
            aria-label={t('musicPublishers.hero.figureAriaD')}
          >
            {/* reference recording (external, left) */}
            <g className="plx" data-plx="0">
              <circle cx="120" cy="220" r="30" fill={url('haloA')} />
              <circle cx="120" cy="220" r="10" fill="none" stroke="rgba(238,74,38,.55)" />
              <circle cx="120" cy="220" r="4.2" fill="#EE4A26" />
              <text x="120" y="176" fontSize="10" letterSpacing="2.5" textAnchor="middle" fill="rgba(255,255,255,.92)">
                {t('musicPublishers.figures.referenceRecording')}
              </text>
              <text x="120" y="264" fontSize="7.5" letterSpacing="1.5" textAnchor="middle" fill="rgba(185,185,185,.5)">
                {t('musicPublishers.figures.currentOpportunity')}
              </text>
            </g>

            {/* pyxis-1 open ring on the route */}
            <g className="plx" data-plx="0.1">
              <circle
                cx="240"
                cy="220"
                r="46"
                fill="none"
                stroke="rgba(255,255,255,.25)"
                strokeDasharray="180 110"
                transform="rotate(150 240 220)"
              />
              <circle
                cx="240"
                cy="220"
                r="62"
                fill="none"
                stroke="rgba(255,255,255,.09)"
                strokeDasharray="80 310"
                transform="rotate(-40 240 220)"
              />
              <g stroke="rgba(255,255,255,.4)">
                <line x1="240" y1="164" x2="240" y2="176" />
                <line x1="240" y1="264" x2="240" y2="276" />
                <line x1="184" y1="220" x2="196" y2="220" />
              </g>
              <rect
                x="234"
                y="214"
                width="12"
                height="12"
                fill="#0C0C0D"
                stroke="rgba(238,74,38,.85)"
                transform="rotate(45 240 220)"
              />
              <text x="240" y="146" fontSize="9.5" letterSpacing="3" textAnchor="middle" fill="rgba(255,255,255,.92)">
                {t('musicPublishers.figures.pyxis')}
              </text>
            </g>

            {/* the route */}
            <path
              className="sig"
              d="M 132 220 H 182 M 298 220 C 330 220, 348 220, 372 220"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />
            <text x="316" y="204" fontSize="7.5" letterSpacing="1.5" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.sonicRelationship')}
            </text>

            {/* bounded publisher catalogue */}
            <g>
              <rect x="340" y="64" width="800" height="312" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 6" />
              <g stroke="rgba(255,255,255,.34)" fill="none">
                <path d="M 340 78 V 64 H 356" />
                <path d="M 1124 64 H 1140 V 78" />
                <path d="M 340 362 V 376 H 356" />
                <path d="M 1124 376 H 1140 V 362" />
              </g>
              <text x="340" y="52" fontSize="10" letterSpacing="2.5" fill="rgba(255,255,255,.92)">
                {t('musicPublishers.figures.publisherCatalogue')}
              </text>
              <text x="1140" y="52" fontSize="8" letterSpacing="1.5" textAnchor="end" fill="rgba(185,185,185,.55)">
                {t('musicPublishers.figures.partnerScopedIndex')}
              </text>

              {/* archival matrix */}
              <g mask={url('fieldMaskA')}>
                <rect x="352" y="76" width="776" height="288" fill={url('cellsA')} />
                <rect x="352" y="76" width="776" height="288" fill={url('cellsB')} />
              </g>

              {/* era rulers */}
              <g stroke="rgba(255,255,255,.08)">
                <line x1="352" y1="388" x2="1128" y2="388" />
              </g>
              <text x="352" y="402" fontSize="7" letterSpacing="1.5" fill="rgba(185,185,185,.4)">
                {t('musicPublishers.figures.earlierCatalogue')}
              </text>
              <text x="1128" y="402" fontSize="7" letterSpacing="1.5" textAnchor="end" fill="rgba(185,185,185,.4)">
                {t('musicPublishers.figures.recentDeliveries')}
              </text>

              {/* route continues inside the field */}
              <path
                className="sig"
                d="M 372 220 C 470 218, 520 200, 592 186 C 660 174, 700 168, 748 162"
                fill="none"
                stroke="#EE4A26"
                strokeWidth="1.6"
              />

              {/* surfaced works across periods */}
              <g className="resolve d1">
                <rect x="742" y="156" width="20" height="12" fill="rgba(255,255,255,.92)" />
                <line x1="745" y1="162" x2="759" y2="162" stroke="#101010" />
                <rect x="738" y="152" width="28" height="20" fill="none" stroke="rgba(238,74,38,.8)" />
              </g>
              <g className="resolve d2">
                <rect x="530" y="262" width="20" height="12" fill="rgba(255,255,255,.8)" />
              </g>
              <g className="resolve d3">
                <rect x="898" y="118" width="20" height="12" fill="rgba(255,255,255,.75)" />
              </g>
              <g className="resolve d4">
                <rect x="646" y="318" width="20" height="12" fill="rgba(255,255,255,.7)" />
              </g>
              <g className="resolve d5">
                <rect x="1006" y="238" width="20" height="12" fill="rgba(255,255,255,.66)" />
              </g>
              <g stroke="rgba(255,255,255,.18)">
                <line x1="762" y1="168" x2="550" y2="262" className="resolve d2" />
                <line x1="766" y1="162" x2="898" y2="124" className="resolve d3" />
                <line x1="758" y1="172" x2="666" y2="318" className="resolve d4" />
                <line x1="770" y1="166" x2="1006" y2="244" className="resolve d5" />
              </g>
              <text x="786" y="146" fontSize="8" letterSpacing="1.5" fill="rgba(255,255,255,.75)" className="resolve d1">
                {t('musicPublishers.figures.relatedWorksSurfaced')}
              </text>

              {/* older work beside recent work */}
              <g className="resolve d4">
                <text x="646" y="346" fontSize="7" letterSpacing="1.2" fill="rgba(238,74,38,.7)">
                  {t('musicPublishers.figures.olderWork')}
                </text>
              </g>
              <g className="resolve d3">
                <text x="898" y="110" fontSize="7" letterSpacing="1.2" fill="rgba(185,185,185,.55)">
                  {t('musicPublishers.figures.recentWork')}
                </text>
              </g>

              {/* represented-work callout */}
              <g>
                <rect x="424" y="122" width="20" height="12" fill="rgba(255,255,255,.5)" />
                <line x1="427" y1="128" x2="441" y2="128" stroke="#101010" />
                <line x1="446" y1="122" x2="470" y2="102" stroke="rgba(255,255,255,.14)" />
                <text x="474" y="100" fontSize="7" letterSpacing="1.2" fill="rgba(185,185,185,.5)">
                  {t('musicPublishers.figures.representedWorkCallout')}
                </text>
              </g>
            </g>
          </svg>

          {/* ================= HERO · MOBILE ================= */}
          <svg
            className="mp-m-only"
            viewBox="0 0 390 560"
            role="img"
            aria-label={t('musicPublishers.hero.figureAriaM')}
          >
            <circle cx="195" cy="54" r="26" fill={url('haloAm')} />
            <circle cx="195" cy="54" r="9" fill="none" stroke="rgba(238,74,38,.55)" />
            <circle cx="195" cy="54" r="3.8" fill="#EE4A26" />
            <text x="195" y="20" fontSize="9.5" letterSpacing="2" textAnchor="middle" fill="rgba(255,255,255,.92)">
              {t('musicPublishers.figures.referenceRecording')}
            </text>

            <path className="sig" d="M 195 66 V 106" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            <circle
              cx="195"
              cy="146"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,.25)"
              strokeDasharray="135 78"
              transform="rotate(150 195 146)"
            />
            <rect
              x="190"
              y="141"
              width="10"
              height="10"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 195 146)"
            />
            <text x="240" y="150" fontSize="9" letterSpacing="2.5" fill="rgba(255,255,255,.92)">
              {t('musicPublishers.figures.pyxis')}
            </text>

            <path className="sig" d="M 195 182 V 222" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            <rect x="28" y="228" width="334" height="270" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 6" />
            <g stroke="rgba(255,255,255,.34)" fill="none">
              <path d="M 28 240 V 228 H 40" />
              <path d="M 350 228 H 362 V 240" />
              <path d="M 28 486 V 498 H 40" />
              <path d="M 350 498 H 362 V 486" />
            </g>
            <text x="28" y="218" fontSize="9" letterSpacing="1.8" fill="rgba(255,255,255,.92)">
              {t('musicPublishers.figures.publisherCatalogue')}
            </text>
            <g>
              <rect x="40" y="240" width="310" height="246" fill={url('cellsAm')} />
              <rect x="40" y="240" width="310" height="246" fill={url('cellsBm')} />
            </g>
            <path
              className="sig"
              d="M 195 228 C 195 260, 178 286, 162 306"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />
            <g className="resolve d1">
              <rect x="152" y="306" width="18" height="11" fill="rgba(255,255,255,.92)" />
              <rect x="148" y="302" width="26" height="19" fill="none" stroke="rgba(238,74,38,.8)" />
            </g>
            <g className="resolve d2">
              <rect x="84" y="368" width="18" height="11" fill="rgba(255,255,255,.8)" />
            </g>
            <g className="resolve d3">
              <rect x="252" y="284" width="18" height="11" fill="rgba(255,255,255,.75)" />
            </g>
            <g className="resolve d4">
              <rect x="120" y="430" width="18" height="11" fill="rgba(255,255,255,.7)" />
            </g>
            <g className="resolve d5">
              <rect x="272" y="404" width="18" height="11" fill="rgba(255,255,255,.66)" />
            </g>
            <g stroke="rgba(255,255,255,.18)">
              <line x1="161" y1="317" x2="93" y2="368" className="resolve d2" />
              <line x1="170" y1="311" x2="252" y2="290" className="resolve d3" />
              <line x1="161" y1="317" x2="129" y2="430" className="resolve d4" />
              <line x1="170" y1="315" x2="272" y2="409" className="resolve d5" />
            </g>
            <text x="195" y="524" fontSize="8" letterSpacing="1.6" textAnchor="middle" fill="rgba(255,255,255,.75)">
              {t('musicPublishers.figures.relatedPublisherWorks')}
            </text>
            <text x="120" y="456" fontSize="6.8" letterSpacing="1" fill="rgba(238,74,38,.7)">
              {t('musicPublishers.figures.olderWork')}
            </text>
            <text x="252" y="278" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.recentWork')}
            </text>
          </svg>
        </div>

        <div className="mp-fig-caption">
          <span>{t('musicPublishers.hero.captionA')}</span>
          <span>{t('musicPublishers.hero.captionB')}</span>
        </div>
      </div>
    </section>
  );
}
