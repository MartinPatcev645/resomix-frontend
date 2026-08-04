import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCiDefs } from './ciDefs.ts';
import { CI_REF_ID, CI_RESULT_ROWS } from './ciData.ts';
import { HeroTitle } from '@/components/HeroTitle.tsx';

type CiHeroProps = {
  /** Optional override for the "see how it works" scroll target — falls back
   * to scrolling #ci-s3 into view directly when the page doesn't supply one. */
  onScrollToHow?: () => void;
};

/* S1 · Hero — Signal Lattice v1.1. Geometry transplanted verbatim from the
   approved preview (`#s1`); shared defs live in CiSharedDefs. */
export function CiHero({ onScrollToHow }: CiHeroProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = useCiDefs();

  const handleScrollToHow = () => {
    if (onScrollToHow) {
      onScrollToHow();
      return;
    }
    document.getElementById('ci-s3')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="ci-hero ci-section rx-hero-pad" id="ci-s1">
      <div className="ci-wrap">
        <div className="ci-eyebrow">{t('catalogueIntelligence.hero.eyebrow')}</div>
        <h1 className="ci-h1">
          <HeroTitle text={t('catalogueIntelligence.hero.title')} emClass="ci-em" />
        </h1>
        <p className="ci-body-p ci-copycol">{t('catalogueIntelligence.hero.body')}</p>
        <div className="ci-cta-row">
          <button
            type="button"
            className="ci-btn ci-primary"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('catalogueIntelligence.hero.ctaPrimary')}
          </button>
          <button type="button" className="ci-btn" onClick={handleScrollToHow}>
            {t('catalogueIntelligence.hero.ctaSecondary')}
          </button>
        </div>
        <div className="ci-status-rail">{t('catalogueIntelligence.hero.status')}</div>
      </div>

      <div className="ci-wrap ci-bleed ci-hero-fig">
        <div className="ci-stagebox">
          <div className="ci-grain" aria-hidden="true" />

          {/* ============ HERO LATTICE · DESKTOP ============ */}
          <svg
            className="ci-d-only"
            viewBox="0 0 1200 440"
            role="img"
            aria-label={t('catalogueIntelligence.hero.figureAriaD')}
          >
            <line x1="0" y1="396" x2="1200" y2="396" stroke="rgba(255,255,255,.06)" />
            <g stroke="rgba(255,255,255,.05)">
              <line x1="180" y1="392" x2="180" y2="400" />
              <line x1="480" y1="392" x2="480" y2="400" />
              <line x1="780" y1="392" x2="780" y2="400" />
              <line x1="1080" y1="392" x2="1080" y2="400" />
            </g>
            <g className="ci-plx" data-plx="0.3">
              <polygon points="70,60 240,48 244,86 74,100" fill="#121213" stroke="rgba(255,255,255,.05)" />
              <line x1="70" y1="60" x2="240" y2="48" stroke="rgba(255,255,255,.14)" />
              <polygon
                points="1030,336 1160,326 1164,354 1034,366"
                fill="#121213"
                stroke="rgba(255,255,255,.045)"
              />
            </g>

            {/* reference recording (orange cell) */}
            <g className="ci-plx" data-plx="0">
              <circle cx="120" cy="210" r="30" fill={url('halo')} />
              <rect x="106" y="203" width="28" height="15" fill="#EE4A26" />
              <line x1="111" y1="210" x2="129" y2="210" stroke="#101010" />
              <text x="120" y="168" fontSize="10" letterSpacing="2.5" textAnchor="middle" fill="rgba(255,255,255,.92)">
                {t('catalogueIntelligence.figures.referenceRecording')}
              </text>
              <text x="120" y="248" fontSize="7.5" letterSpacing="1.2" textAnchor="middle" fill="rgba(185,185,185,.5)">
                {CI_REF_ID}
              </text>
            </g>

            {/* pyxis-1 open comparison ring */}
            <g className="ci-plx" data-plx="0.1">
              <circle
                cx="255"
                cy="210"
                r="44"
                fill="none"
                stroke="rgba(255,255,255,.25)"
                strokeDasharray="172 105"
                transform="rotate(150 255 210)"
              />
              <circle
                cx="255"
                cy="210"
                r="60"
                fill="none"
                stroke="rgba(255,255,255,.09)"
                strokeDasharray="76 302"
                transform="rotate(-40 255 210)"
              />
              <g stroke="rgba(255,255,255,.4)">
                <line x1="255" y1="156" x2="255" y2="168" />
                <line x1="255" y1="252" x2="255" y2="264" />
                <line x1="201" y1="210" x2="213" y2="210" />
              </g>
              <rect
                x="249"
                y="204"
                width="12"
                height="12"
                fill="#0C0C0D"
                stroke="rgba(238,74,38,.85)"
                transform="rotate(45 255 210)"
                className="ci-breathe"
              />
              <text x="255" y="138" fontSize="9.5" letterSpacing="3" textAnchor="middle" fill="rgba(255,255,255,.92)">
                {t('catalogueIntelligence.figures.pyxis')}
              </text>
            </g>

            <path className="ci-sig" d="M 134 210 H 200 M 312 210 H 372" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            {/* bounded partner index */}
            <g>
              <rect x="384" y="70" width="500" height="300" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 6" />
              <g stroke="rgba(255,255,255,.34)" fill="none">
                <path d="M 384 84 V 70 H 400" />
                <path d="M 868 70 H 884 V 84" />
                <path d="M 384 356 V 370 H 400" />
                <path d="M 868 370 H 884 V 356" />
              </g>
              <text x="384" y="58" fontSize="11" letterSpacing="2.5" fill="rgba(255,255,255,.95)">
                {t('catalogueIntelligence.figures.partnerScopedIndex')}
              </text>
              <text x="884" y="390" fontSize="8.5" letterSpacing="1.5" textAnchor="end" fill="rgba(185,185,185,.62)">
                {t('catalogueIntelligence.figures.profilesPrepared')}
              </text>
              <g>
                <rect x="398" y="84" width="472" height="272" fill={url('cells')} />
                <rect x="398" y="84" width="472" height="272" fill={url('cellsMark')} />
              </g>

              {/* route inside the field */}
              <path
                className="ci-sig"
                d="M 372 210 C 460 208, 520 196, 596 184"
                fill="none"
                stroke="#EE4A26"
                strokeWidth="1.6"
              />

              {/* closest relationships come forward */}
              <g className="ci-resolve d1">
                <rect x="590" y="176" width="20" height="12" fill="rgba(255,255,255,.95)" />
                <line x1="594" y1="182" x2="606" y2="182" stroke="#101010" />
                <rect x="586" y="172" width="28" height="20" fill="none" stroke="rgba(238,74,38,.8)" />
              </g>
              <g className="ci-resolve d2">
                <rect x="472" y="266" width="20" height="12" fill="rgba(255,255,255,.82)" />
                <line x1="476" y1="272" x2="488" y2="272" stroke="#101010" />
              </g>
              <g className="ci-resolve d3">
                <rect x="706" y="128" width="20" height="12" fill="rgba(255,255,255,.76)" />
                <line x1="710" y1="134" x2="722" y2="134" stroke="#101010" />
              </g>
              <g className="ci-resolve d4">
                <rect x="668" y="292" width="20" height="12" fill="rgba(255,255,255,.7)" />
                <line x1="672" y1="298" x2="684" y2="298" stroke="#101010" />
              </g>
              <g className="ci-resolve d5">
                <rect x="790" y="222" width="20" height="12" fill="rgba(255,255,255,.66)" />
                <line x1="794" y1="228" x2="806" y2="228" stroke="#101010" />
              </g>
              <g stroke="rgba(255,255,255,.18)">
                <line x1="610" y1="188" x2="492" y2="266" className="ci-resolve d2" />
                <line x1="614" y1="182" x2="706" y2="134" className="ci-resolve d3" />
                <line x1="608" y1="192" x2="688" y2="292" className="ci-resolve d4" />
                <line x1="614" y1="186" x2="790" y2="228" className="ci-resolve d5" />
              </g>
              <text
                x="620"
                y="164"
                fontSize="8"
                letterSpacing="1.5"
                fill="rgba(255,255,255,.75)"
                className="ci-resolve d1"
              >
                {t('catalogueIntelligence.figures.closestRelationships')}
              </text>
            </g>

            {/* ranked results */}
            <rect x="972" y="96" width="192" height="252" fill="rgba(255,255,255,.015)" stroke="rgba(255,255,255,.07)" />
            <text x="1150" y="122" fontSize="11.5" letterSpacing="2" textAnchor="end" fill="rgba(255,255,255,.95)">
              {t('catalogueIntelligence.figures.rankedCatalogueResults')}
            </text>
            <text x="1150" y="138" fontSize="8.5" letterSpacing="1.4" textAnchor="end" fill="rgba(185,185,185,.6)">
              {t('catalogueIntelligence.figures.automaticRanking')}
            </text>
            <line x1="990" y1="154" x2="990" y2="330" stroke="rgba(255,255,255,.2)" />
            <g className="ci-resolve d1">
              <line x1="990" y1="164" x2="1008" y2="164" stroke="rgba(238,74,38,.8)" strokeWidth="1.2" />
              <rect x="1014" y="155" width="26" height="16" fill="rgba(255,255,255,.95)" />
              <rect x="1010" y="151" width="34" height="24" fill="none" stroke="rgba(238,74,38,.8)" />
              <text x="1054" y="170" fontSize="10.5" letterSpacing="1.5" fill="#EE4A26">
                {CI_RESULT_ROWS[0].rank}
              </text>
              <text x="1150" y="170" fontSize="9" letterSpacing="1" textAnchor="end" fill="rgba(238,74,38,.9)">
                {CI_RESULT_ROWS[0].score}
              </text>
            </g>
            <g className="ci-resolve d2">
              <line x1="990" y1="202" x2="1010" y2="202" stroke="rgba(255,255,255,.26)" />
              <rect x="1014" y="193" width="26" height="16" fill="rgba(255,255,255,.82)" />
              <text x="1054" y="208" fontSize="10.5" letterSpacing="1.5" fill="rgba(255,255,255,.7)">
                {CI_RESULT_ROWS[1].rank}
              </text>
              <text x="1150" y="208" fontSize="8.5" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.6)">
                {CI_RESULT_ROWS[1].score}
              </text>
            </g>
            <g className="ci-resolve d3">
              <line x1="990" y1="240" x2="1010" y2="240" stroke="rgba(255,255,255,.22)" />
              <rect x="1014" y="231" width="26" height="16" fill="rgba(255,255,255,.74)" />
              <text x="1054" y="246" fontSize="10.5" letterSpacing="1.5" fill="rgba(255,255,255,.66)">
                {CI_RESULT_ROWS[2].rank}
              </text>
              <text x="1150" y="246" fontSize="8.5" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.55)">
                {CI_RESULT_ROWS[2].score}
              </text>
            </g>
            <g className="ci-resolve d4">
              <line x1="990" y1="278" x2="1010" y2="278" stroke="rgba(255,255,255,.18)" />
              <rect x="1014" y="269" width="26" height="16" fill="rgba(255,255,255,.68)" />
              <text x="1054" y="284" fontSize="10.5" letterSpacing="1.5" fill="rgba(255,255,255,.62)">
                {CI_RESULT_ROWS[3].rank}
              </text>
              <text x="1150" y="284" fontSize="8.5" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.5)">
                {CI_RESULT_ROWS[3].score}
              </text>
            </g>
            <g className="ci-resolve d5">
              <line x1="990" y1="316" x2="1010" y2="316" stroke="rgba(255,255,255,.15)" />
              <rect x="1014" y="307" width="26" height="16" fill="rgba(255,255,255,.62)" />
              <text x="1054" y="322" fontSize="10.5" letterSpacing="1.5" fill="rgba(255,255,255,.58)">
                {CI_RESULT_ROWS[4].rank}
              </text>
              <text x="1150" y="322" fontSize="8.5" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.45)">
                {CI_RESULT_ROWS[4].score}
              </text>
            </g>
            <path
              className="ci-sig"
              d="M 884 196 C 928 190, 950 176, 1004 166"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />
          </svg>

          {/* ============ HERO LATTICE · MOBILE ============ */}
          <svg
            className="ci-m-only"
            viewBox="0 0 390 640"
            role="img"
            aria-label={t('catalogueIntelligence.hero.figureAriaM')}
          >
            <circle cx="195" cy="52" r="26" fill={url('halo')} />
            <rect x="182" y="46" width="26" height="14" fill="#EE4A26" />
            <line x1="187" y1="53" x2="203" y2="53" stroke="#101010" />
            <text x="195" y="18" fontSize="14" letterSpacing="2" textAnchor="middle" fill="rgba(255,255,255,.92)">
              {t('catalogueIntelligence.figures.referenceRecording')}
            </text>
            <path className="ci-sig" d="M 195 64 V 100" fill="none" stroke="#EE4A26" strokeWidth="1.6" />
            <circle
              cx="195"
              cy="138"
              r="32"
              fill="none"
              stroke="rgba(255,255,255,.25)"
              strokeDasharray="126 74"
              transform="rotate(150 195 138)"
            />
            <rect
              x="190"
              y="133"
              width="10"
              height="10"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 195 138)"
            />
            <text x="238" y="142" fontSize="14" letterSpacing="2.5" fill="rgba(255,255,255,.92)">
              {t('catalogueIntelligence.figures.pyxis')}
            </text>
            <path className="ci-sig" d="M 195 172 V 206" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            <rect x="28" y="212" width="334" height="220" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 6" />
            <g stroke="rgba(255,255,255,.34)" fill="none">
              <path d="M 28 224 V 212 H 40" />
              <path d="M 350 212 H 362 V 224" />
              <path d="M 28 420 V 432 H 40" />
              <path d="M 350 432 H 362 V 420" />
            </g>
            <text x="28" y="202" fontSize="14" letterSpacing="1.6" fill="rgba(255,255,255,.95)">
              {t('catalogueIntelligence.figures.partnerScopedIndex')}
            </text>
            <g>
              <rect x="40" y="224" width="310" height="196" fill={url('cells')} />
              <rect x="40" y="224" width="310" height="196" fill={url('cellsMark')} />
            </g>
            <path
              className="ci-sig"
              d="M 195 212 C 195 244, 180 262, 168 278"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />
            <g className="ci-resolve d1">
              <rect x="158" y="278" width="18" height="11" fill="rgba(255,255,255,.95)" />
              <rect x="154" y="274" width="26" height="19" fill="none" stroke="rgba(238,74,38,.8)" />
            </g>
            <g className="ci-resolve d2">
              <rect x="90" y="340" width="18" height="11" fill="rgba(255,255,255,.8)" />
            </g>
            <g className="ci-resolve d3">
              <rect x="250" y="264" width="18" height="11" fill="rgba(255,255,255,.74)" />
            </g>
            <g className="ci-resolve d4">
              <rect x="128" y="392" width="18" height="11" fill="rgba(255,255,255,.68)" />
            </g>
            <g className="ci-resolve d5">
              <rect x="270" y="372" width="18" height="11" fill="rgba(255,255,255,.62)" />
            </g>
            <text x="40" y="452" fontSize="7.8" letterSpacing="1" fill="rgba(185,185,185,.62)">
              {t('catalogueIntelligence.figures.profilesPrepared')}
            </text>

            <path className="ci-sig" d="M 195 432 V 470" fill="none" stroke="#EE4A26" strokeWidth="1.6" />
            <text x="195" y="494" fontSize="14" letterSpacing="1.6" textAnchor="middle" fill="rgba(255,255,255,.95)">
              {t('catalogueIntelligence.figures.rankedCatalogueResults')}
            </text>
            <text x="195" y="508" fontSize="14" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.6)">
              {t('catalogueIntelligence.figures.automaticRanking')}
            </text>
            <line x1="140" y1="520" x2="140" y2="622" stroke="rgba(255,255,255,.2)" />
            <g className="ci-resolve d1">
              <line x1="140" y1="530" x2="156" y2="530" stroke="rgba(238,74,38,.8)" strokeWidth="1.2" />
              <rect x="160" y="523" width="22" height="13" fill="rgba(255,255,255,.95)" />
              <text x="194" y="534" fontSize="14" letterSpacing="1.4" fill="#EE4A26">
                {CI_RESULT_ROWS[0].rank}
              </text>
              <text x="346" y="534" fontSize="14" letterSpacing="1" textAnchor="end" fill="rgba(238,74,38,.9)">
                {CI_RESULT_ROWS[0].score}
              </text>
            </g>
            <g className="ci-resolve d2">
              <line x1="140" y1="552" x2="156" y2="552" stroke="rgba(255,255,255,.26)" />
              <rect x="160" y="545" width="22" height="13" fill="rgba(255,255,255,.82)" />
              <text x="194" y="556" fontSize="14" letterSpacing="1.4" fill="rgba(255,255,255,.7)">
                {CI_RESULT_ROWS[1].rank}
              </text>
              <text x="346" y="556" fontSize="14" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.6)">
                {CI_RESULT_ROWS[1].score}
              </text>
            </g>
            <g className="ci-resolve d3">
              <line x1="140" y1="574" x2="156" y2="574" stroke="rgba(255,255,255,.22)" />
              <rect x="160" y="567" width="22" height="13" fill="rgba(255,255,255,.74)" />
              <text x="194" y="578" fontSize="14" letterSpacing="1.4" fill="rgba(255,255,255,.66)">
                {CI_RESULT_ROWS[2].rank}
              </text>
              <text x="346" y="578" fontSize="14" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.55)">
                {CI_RESULT_ROWS[2].score}
              </text>
            </g>
            <g className="ci-resolve d4">
              <line x1="140" y1="596" x2="156" y2="596" stroke="rgba(255,255,255,.18)" />
              <rect x="160" y="589" width="22" height="13" fill="rgba(255,255,255,.68)" />
              <text x="194" y="600" fontSize="14" letterSpacing="1.4" fill="rgba(255,255,255,.62)">
                {CI_RESULT_ROWS[3].rank}
              </text>
              <text x="346" y="600" fontSize="14" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.5)">
                {CI_RESULT_ROWS[3].score}
              </text>
            </g>
            <g className="ci-resolve d5">
              <line x1="140" y1="618" x2="156" y2="618" stroke="rgba(255,255,255,.15)" />
              <rect x="160" y="611" width="22" height="13" fill="rgba(255,255,255,.62)" />
              <text x="194" y="622" fontSize="14" letterSpacing="1.4" fill="rgba(255,255,255,.58)">
                {CI_RESULT_ROWS[4].rank}
              </text>
              <text x="346" y="622" fontSize="14" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.45)">
                {CI_RESULT_ROWS[4].score}
              </text>
            </g>
          </svg>
        </div>

        <div className="ci-fig-caption">
          <span>{t('catalogueIntelligence.hero.captionA')}</span>
          <span>{t('catalogueIntelligence.hero.captionB')}</span>
        </div>
      </div>
    </section>
  );
}
