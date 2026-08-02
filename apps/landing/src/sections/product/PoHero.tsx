import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';
import { usePoDefs } from './poDefs.ts';

/* S1 · Hero — Sonic Routing Desk v1.1. Geometry transplanted verbatim from the
   approved preview (`#s1`); shared defs live in PoSharedDefs. */
export function PoHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { url } = usePoDefs();
  const f = (key: string) => t(`product.figures.${key}`);

  return (
    <section className="po-hero po-section" id="po-s1">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.hero.eyebrow')}</div>
        <h1 className="po-h1">
          {t('product.hero.h1Lead')}{' '}
          <span className="po-em">{t('product.hero.h1Em')}</span>
        </h1>
        <p className="po-body-p po-copycol">{t('product.hero.body')}</p>
        <div className="po-cta-row">
          <button
            type="button"
            className="po-btn po-primary"
            onClick={() => {
              window.location.href = BASE_BETA_URL;
            }}
          >
            {t('product.hero.ctaPrimary')}
          </button>
          <button
            type="button"
            className="po-btn"
            onClick={() =>
              document.getElementById('po-s2')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            {t('product.hero.ctaSecondary')}
          </button>
          <button type="button" className="po-text-link" onClick={() => navigate('/partners/pilot')}>
            {t('product.hero.ctaPilot')}
          </button>
        </div>
        <div className="po-status-rail">{t('product.hero.status')}</div>
      </div>

      <div className="po-wrap po-bleed" style={{ paddingTop: '2.2rem' }}>
        <div className="po-stagebox">
          <div className="po-grain" aria-hidden="true" />

          {/* ============ HERO LANES · DESKTOP ============ */}
          <svg
            className="po-d-only"
            viewBox="0 0 1200 500"
            role="img"
            aria-label={t('product.hero.figureAriaD')}
          >
            <rect x="368" y="36" width="104" height="440" fill="rgba(255,255,255,.015)" stroke="rgba(255,255,255,.09)" />
            <text x="420" y="26" fontSize="11" letterSpacing="3" textAnchor="middle" fill="rgba(255,255,255,.95)">
              {f('pyxis')}
            </text>
            <circle
              cx="420"
              cy="130"
              r="26"
              fill="none"
              stroke="rgba(255,255,255,.46)"
              strokeDasharray="102 62"
              transform="rotate(150 420 130)"
            />
            <rect
              x="415"
              y="125"
              width="10"
              height="10"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 420 130)"
              className="po-breathe"
            />
            <circle
              cx="420"
              cy="278"
              r="26"
              fill="none"
              stroke="rgba(255,255,255,.46)"
              strokeDasharray="102 62"
              transform="rotate(30 420 278)"
            />
            <rect
              x="415"
              y="273"
              width="10"
              height="10"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 420 278)"
            />
            <circle
              cx="420"
              cy="420"
              r="26"
              fill="none"
              stroke="rgba(255,255,255,.46)"
              strokeDasharray="102 62"
              transform="rotate(-70 420 420)"
            />
            <rect
              x="415"
              y="415"
              width="10"
              height="10"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 420 420)"
            />
            <text x="420" y="492" fontSize="8" letterSpacing="1.6" textAnchor="middle" fill="rgba(185,185,185,.8)">
              {f('distinctWorkflows')}
            </text>

            {/* LANE 1 · SONIC DISCOVERY */}
            <text x="40" y="66" fontSize="10" letterSpacing="2.2" fill="rgba(255,255,255,.95)">
              {f('sonicDiscovery')}
            </text>
            <circle cx="82" cy="120" r="20" fill={url('halo')} />
            <rect x="70" y="113" width="24" height="14" fill="#EE4A26" />
            <line x1="75" y1="120" x2="89" y2="120" stroke="#101010" />
            <text x="40" y="158" fontSize="8" letterSpacing="1" fill="rgba(185,185,185,.85)">
              {f('searchedTrackOr')}
            </text>
            <text x="40" y="171" fontSize="8" letterSpacing="1" fill="rgba(185,185,185,.85)">
              {f('uploadedReference')}
            </text>
            <path className="po-sig" d="M 96 120 H 388" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <text x="222" y="140" fontSize="7.5" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.76)">
              {f('sonicProfileComparison')}
            </text>
            <path className="po-sig" d="M 452 130 H 560" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <g>
              <rect x="572" y="52" width="240" height="150" fill="#1C1C1F" stroke="rgba(255,255,255,.28)" />
              <text x="588" y="76" fontSize="8" letterSpacing="1.4" fill="rgba(255,255,255,.94)">
                {f('rankedDiscoveryPlaylist')}
              </text>
              <g fontSize="8" letterSpacing="1">
                <g className="po-resolve d1">
                  <rect x="588" y="88" width="210" height="19" fill="rgba(238,74,38,.12)" />
                  <text x="596" y="101" fill="#EE4A26">
                    {f('rank01')}
                  </text>
                  <text x="626" y="101" fill="rgba(255,255,255,.95)">
                    {f('nightTransit')}
                  </text>
                  <text x="790" y="101" textAnchor="end" fill="rgba(238,74,38,.9)">
                    {f('score931')}
                  </text>
                </g>
                <g className="po-resolve d2">
                  <text x="596" y="124" fill="rgba(255,255,255,.76)">
                    {f('rank02')}
                  </text>
                  <text x="626" y="124" fill="rgba(255,255,255,.94)">
                    {f('glassHarbour')}
                  </text>
                  <text x="790" y="124" textAnchor="end" fill="rgba(185,185,185,.8)">
                    {f('score924')}
                  </text>
                </g>
                <g className="po-resolve d3">
                  <text x="596" y="146" fill="rgba(255,255,255,.73)">
                    {f('rank03')}
                  </text>
                  <text x="626" y="146" fill="rgba(255,255,255,.9)">
                    {f('lowAltitude')}
                  </text>
                  <text x="790" y="146" textAnchor="end" fill="rgba(185,185,185,.76)">
                    {f('score918')}
                  </text>
                </g>
                <g className="po-resolve d4">
                  <text x="596" y="168" fill="rgba(255,255,255,.7)">
                    {f('rank04')}
                  </text>
                  <text x="626" y="168" fill="rgba(255,255,255,.86)">
                    {f('stillCurrent')}
                  </text>
                  <text x="790" y="168" textAnchor="end" fill="rgba(185,185,185,.72)">
                    {f('score912')}
                  </text>
                </g>
                <g className="po-resolve d5">
                  <text x="596" y="190" fill="rgba(255,255,255,.67)">
                    {f('rank05')}
                  </text>
                  <text x="626" y="190" fill="rgba(255,255,255,.83)">
                    {f('paleMeridian')}
                  </text>
                  <text x="790" y="190" textAnchor="end" fill="rgba(185,185,185,.45)">
                    {f('score909')}
                  </text>
                </g>
              </g>
            </g>

            {/* LANE 2 · TRACK INTELLIGENCE */}
            <line x1="40" y1="228" x2="1160" y2="228" stroke="rgba(255,255,255,.1)" />
            <text x="40" y="256" fontSize="10" letterSpacing="2.2" fill="rgba(255,255,255,.95)">
              {f('trackIntelligence')}
            </text>
            <rect x="70" y="270" width="24" height="14" fill="rgba(255,255,255,.94)" />
            <line x1="75" y1="277" x2="89" y2="277" stroke="#101010" />
            <text x="40" y="312" fontSize="8" letterSpacing="1" fill="rgba(185,185,185,.85)">
              {f('oneAudioRecording')}
            </text>
            <path className="po-sig" d="M 96 277 H 388" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <text x="240" y="296" fontSize="7.5" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.76)">
              {f('characteristicsAnalysed')}
            </text>
            <path className="po-sig" d="M 452 278 H 560" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <g>
              <rect x="572" y="240" width="240" height="96" fill="#1C1C1F" stroke="rgba(255,255,255,.28)" />
              <text x="588" y="262" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.94)">
                {f('readableTiView')}
              </text>
              <g fontSize="6.4" letterSpacing=".8" fill="rgba(185,185,185,.72)">
                <rect x="588" y="272" width="30" height="8" fill="rgba(255,255,255,.08)" stroke="none" />
                <text x="590" y="290">
                  {f('intro')}
                </text>
                <rect x="620" y="272" width="44" height="8" fill="rgba(255,255,255,.12)" />
                <text x="622" y="290">
                  {f('build')}
                </text>
                <rect x="666" y="272" width="52" height="8" fill="rgba(238,74,38,.3)" />
                <text x="668" y="290" fill="rgba(255,255,255,.83)">
                  {f('drop')}
                </text>
                <rect x="720" y="272" width="34" height="8" fill="rgba(255,255,255,.1)" />
                <text x="722" y="290">
                  {f('break')}
                </text>
                <rect x="756" y="272" width="42" height="8" fill="rgba(255,255,255,.08)" />
                <text x="758" y="290">
                  {f('outro')}
                </text>
              </g>
              <path
                d="M 588 318 C 620 314, 650 306, 680 296 C 700 290, 720 292, 740 300 C 764 308, 780 312, 798 314"
                fill="none"
                stroke="rgba(255,255,255,.62)"
                strokeWidth="1.4"
              />
              <circle cx="690" cy="295" r="2.2" fill="#EE4A26" />
            </g>

            {/* LANE 3 · CATALOGUE INTELLIGENCE */}
            <line x1="40" y1="360" x2="1160" y2="360" stroke="rgba(255,255,255,.1)" />
            <text x="40" y="390" fontSize="10" letterSpacing="2.2" fill="rgba(255,255,255,.95)">
              {f('catalogueIntelligence')}
            </text>
            <g>
              <rect x="56" y="404" width="86" height="52" fill="none" stroke="rgba(255,255,255,.46)" />
              <rect x="64" y="412" width="70" height="36" fill={url('cells')} />
            </g>
            <text x="40" y="478" fontSize="8" letterSpacing="1" fill="rgba(185,185,185,.85)">
              {f('authorisedPartnerCatalogue')}
            </text>
            <path className="po-sig" d="M 146 430 H 388" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <text x="268" y="450" fontSize="7.5" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.76)">
              {f('tracksProcessedPrivate')}
            </text>
            <path className="po-sig" d="M 452 420 H 560" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <g>
              <rect x="572" y="376" width="240" height="104" fill="none" stroke="rgba(255,255,255,.44)" strokeWidth="1.5" />
              <rect x="584" y="388" width="130" height="80" fill={url('cells')} />
              <rect x="584" y="388" width="130" height="80" fill={url('cellsMark')} />
              <g fontSize="7.4" letterSpacing=".9">
                <text x="726" y="400" fill="rgba(255,255,255,.83)">
                  {f('cat0417')}
                </text>
                <text x="726" y="416" fill="rgba(255,255,255,.73)">
                  {f('cat1121')}
                </text>
                <text x="726" y="432" fill="rgba(255,255,255,.67)">
                  {f('cat0088')}
                </text>
              </g>
              <text x="588" y="496" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.94)">
                {f('partnerScopedSimAnalysis')}
              </text>
            </g>

            <g fill="rgba(255,255,255,.08)">
              <rect x="960" y="70" width="14" height="8" />
              <rect x="1060" y="140" width="14" height="8" />
              <rect x="1000" y="300" width="14" height="8" />
              <rect x="1090" y="420" width="14" height="8" />
              <rect x="920" y="452" width="14" height="8" />
            </g>
          </svg>

          {/* ============ HERO LANES · MOBILE ============ */}
          <svg
            className="po-m-only"
            viewBox="0 0 390 900"
            role="img"
            aria-label={t('product.hero.figureAriaM')}
          >
            <text x="24" y="26" fontSize="9.5" letterSpacing="1.8" fill="rgba(255,255,255,.95)">
              {f('sonicDiscovery')}
            </text>
            <circle cx="60" cy="62" r="16" fill={url('halo')} />
            <rect x="50" y="56" width="20" height="12" fill="#EE4A26" />
            <text x="82" y="60" fontSize="7.4" letterSpacing=".9" fill="rgba(185,185,185,.85)">
              {f('searchedTrackOrUploaded')}
            </text>
            <path className="po-sig" d="M 60 78 V 108" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <circle
              cx="60"
              cy="126"
              r="14"
              fill="none"
              stroke="rgba(255,255,255,.46)"
              strokeDasharray="55 33"
              transform="rotate(150 60 126)"
            />
            <rect
              x="56"
              y="122"
              width="8"
              height="8"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 60 126)"
            />
            <text x="84" y="130" fontSize="8" letterSpacing="1.4" fill="rgba(255,255,255,.96)">
              {f('pyxis')}
            </text>
            <path className="po-sig" d="M 60 142 V 170" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <rect x="24" y="178" width="342" height="118" fill="#1C1C1F" stroke="rgba(255,255,255,.28)" />
            <text x="40" y="200" fontSize="7.8" letterSpacing="1.2" fill="rgba(255,255,255,.94)">
              {f('rankedDiscoveryPlaylist')}
            </text>
            <g fontSize="7.6" letterSpacing=".9">
              <g className="po-resolve d1">
                <rect x="32" y="208" width="326" height="17" fill="rgba(238,74,38,.12)" />
                <text x="40" y="220" fill="#EE4A26">
                  {f('rank01')}
                </text>
                <text x="66" y="220" fill="rgba(255,255,255,.95)">
                  {f('nightTransit')}
                </text>
                <text x="350" y="220" textAnchor="end" fill="rgba(238,74,38,.9)">
                  {f('score931')}
                </text>
              </g>
              <g className="po-resolve d2">
                <text x="40" y="240" fill="rgba(255,255,255,.76)">
                  {f('rank02')}
                </text>
                <text x="66" y="240" fill="rgba(255,255,255,.94)">
                  {f('glassHarbour')}
                </text>
                <text x="350" y="240" textAnchor="end" fill="rgba(185,185,185,.8)">
                  {f('score924')}
                </text>
              </g>
              <g className="po-resolve d3">
                <text x="40" y="258" fill="rgba(255,255,255,.73)">
                  {f('rank03')}
                </text>
                <text x="66" y="258" fill="rgba(255,255,255,.9)">
                  {f('lowAltitude')}
                </text>
                <text x="350" y="258" textAnchor="end" fill="rgba(185,185,185,.76)">
                  {f('score918')}
                </text>
              </g>
              <g className="po-resolve d4">
                <text x="40" y="276" fill="rgba(255,255,255,.7)">
                  {f('rank04')}
                </text>
                <text x="66" y="276" fill="rgba(255,255,255,.86)">
                  {f('stillCurrent')}
                </text>
                <text x="350" y="276" textAnchor="end" fill="rgba(185,185,185,.72)">
                  {f('score912')}
                </text>
              </g>
              <g className="po-resolve d5">
                <text x="40" y="290" fill="rgba(255,255,255,.67)">
                  {f('rank05')}
                </text>
                <text x="66" y="290" fill="rgba(255,255,255,.83)">
                  {f('paleMeridian')}
                </text>
                <text x="350" y="290" textAnchor="end" fill="rgba(185,185,185,.45)">
                  {f('score909')}
                </text>
              </g>
            </g>

            <line x1="24" y1="322" x2="366" y2="322" stroke="rgba(255,255,255,.13)" />
            <text x="24" y="350" fontSize="9.5" letterSpacing="1.8" fill="rgba(255,255,255,.95)">
              {f('trackIntelligence')}
            </text>
            <rect x="50" y="368" width="20" height="12" fill="rgba(255,255,255,.94)" />
            <text x="82" y="378" fontSize="7.4" letterSpacing=".9" fill="rgba(185,185,185,.85)">
              {f('oneAudioRecording')}
            </text>
            <path className="po-sig" d="M 60 386 V 414" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <circle
              cx="60"
              cy="432"
              r="14"
              fill="none"
              stroke="rgba(255,255,255,.46)"
              strokeDasharray="55 33"
              transform="rotate(30 60 432)"
            />
            <rect
              x="56"
              y="428"
              width="8"
              height="8"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 60 432)"
            />
            <text x="84" y="430" fontSize="7.4" letterSpacing=".9" fill="rgba(185,185,185,.85)">
              {f('characteristicsAnalysed')}
            </text>
            <path className="po-sig" d="M 60 448 V 476" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <rect x="24" y="484" width="342" height="106" fill="#1C1C1F" stroke="rgba(255,255,255,.28)" />
            <text x="40" y="506" fontSize="7.8" letterSpacing="1.2" fill="rgba(255,255,255,.94)">
              {f('readableTiView')}
            </text>
            <g fontSize="6.2" letterSpacing=".7" fill="rgba(185,185,185,.72)">
              <rect x="40" y="516" width="44" height="8" fill="rgba(255,255,255,.08)" />
              <text x="42" y="534">
                {f('intro')}
              </text>
              <rect x="86" y="516" width="66" height="8" fill="rgba(255,255,255,.12)" />
              <text x="88" y="534">
                {f('build')}
              </text>
              <rect x="154" y="516" width="76" height="8" fill="rgba(238,74,38,.3)" />
              <text x="156" y="534" fill="rgba(255,255,255,.83)">
                {f('drop')}
              </text>
              <rect x="232" y="516" width="50" height="8" fill="rgba(255,255,255,.1)" />
              <text x="234" y="534">
                {f('break')}
              </text>
              <rect x="284" y="516" width="66" height="8" fill="rgba(255,255,255,.08)" />
              <text x="286" y="534">
                {f('outro')}
              </text>
            </g>
            <path
              d="M 40 572 C 90 566, 130 554, 176 540 C 210 530, 250 534, 286 546 C 316 556, 336 562, 350 566"
              fill="none"
              stroke="rgba(255,255,255,.6)"
            />
            <circle cx="180" cy="540" r="2.2" fill="#EE4A26" />

            <line x1="24" y1="616" x2="366" y2="616" stroke="rgba(255,255,255,.13)" />
            <text x="24" y="644" fontSize="9.5" letterSpacing="1.8" fill="rgba(255,255,255,.95)">
              {f('catalogueIntelligence')}
            </text>
            <rect x="40" y="658" width="70" height="42" fill="none" stroke="rgba(255,255,255,.46)" />
            <rect x="46" y="664" width="58" height="30" fill={url('cells')} />
            <text x="122" y="676" fontSize="7.4" letterSpacing=".9" fill="rgba(185,185,185,.85)">
              {f('authorisedPartnerCatalogue')}
            </text>
            <path className="po-sig" d="M 75 704 V 730" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <circle
              cx="75"
              cy="748"
              r="14"
              fill="none"
              stroke="rgba(255,255,255,.46)"
              strokeDasharray="55 33"
              transform="rotate(-70 75 748)"
            />
            <rect
              x="71"
              y="744"
              width="8"
              height="8"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 75 748)"
            />
            <text x="99" y="746" fontSize="7.4" letterSpacing=".9" fill="rgba(185,185,185,.85)">
              {f('tracksProcessedPrivate')}
            </text>
            <path className="po-sig" d="M 75 764 V 792" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <rect x="24" y="800" width="342" height="74" fill="none" stroke="rgba(255,255,255,.44)" strokeWidth="1.5" />
            <rect x="36" y="812" width="130" height="50" fill={url('cells')} />
            <rect x="36" y="812" width="130" height="50" fill={url('cellsMark')} />
            <g fontSize="7.4" letterSpacing=".9">
              <text x="186" y="824" fill="rgba(255,255,255,.83)">
                {f('cat0417')}
              </text>
              <text x="186" y="840" fill="rgba(255,255,255,.73)">
                {f('cat1121')}
              </text>
              <text x="186" y="856" fill="rgba(255,255,255,.67)">
                {f('cat0088')}
              </text>
            </g>
            <text x="24" y="892" fontSize="7.8" letterSpacing="1.1" fill="rgba(255,255,255,.94)">
              {f('partnerScopedSimAnalysis')}
            </text>
          </svg>
        </div>
        <div className="po-fig-caption">
          <span>{t('product.hero.captionA')}</span>
          <span>{t('product.hero.captionB')}</span>
        </div>
      </div>
    </section>
  );
}
