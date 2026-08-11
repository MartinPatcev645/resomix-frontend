import { useTranslation } from 'react-i18next';

/* S4 · Track Intelligence — the deeper, separate analysis view. Geometry
   transplanted verbatim from the approved preview; no defs used (no cells /
   halo in this figure). */
export function CiTrackIntel() {
  const { t } = useTranslation('common');

  return (
    <section className="ci-sec ci-section" id="ci-s4">
      <div className="ci-wrap">
        <div className="ci-eyebrow">{t('catalogueIntelligence.trackIntel.eyebrow')}</div>
        <h2 className="ci-h2">{t('catalogueIntelligence.trackIntel.h2')}</h2>
        <div className="ci-copycol">
          <p className="ci-body-p">{t('catalogueIntelligence.trackIntel.body1')}</p>
          <p className="ci-body-p">{t('catalogueIntelligence.trackIntel.body2')}</p>
        </div>
      </div>

      <div className="ci-wrap ci-bleed ci-fig">
        <div className="ci-stagebox">
          <div className="ci-grain" aria-hidden="true" />

          {/* ================= TRACK INTELLIGENCE PANEL · DESKTOP ================= */}
          <svg
            className="ci-d-only"
            viewBox="0 0 1200 350"
            role="img"
            aria-label={t('catalogueIntelligence.trackIntel.figureAriaD')}
          >
            <rect x="40" y="28" width="1120" height="290" fill="#121213" stroke="rgba(255,255,255,.12)" />
            <text x="64" y="62" fontSize="10" letterSpacing="2" fill="rgba(255,255,255,.92)">
              {t('catalogueIntelligence.figures.stillCurrent')}
            </text>
            <text x="64" y="78" fontSize="7.5" letterSpacing="1.2" fill="rgba(185,185,185,.5)">
              {t('catalogueIntelligence.figures.processedRecording')}
            </text>
            <text x="1136" y="62" fontSize="7.5" letterSpacing="1.2" textAnchor="end" fill="rgba(185,185,185,.4)">
              {t('catalogueIntelligence.figures.fictionalValues')}
            </text>

            {/* structural waveform */}
            <path
              d="M 64 150 C 100 146, 130 138, 170 132 C 220 124, 250 108, 300 100 C 340 94, 380 92, 420 96
                 C 470 100, 500 84, 560 76 C 620 68, 660 70, 700 80 C 740 90, 770 110, 820 118
                 C 880 128, 930 122, 990 112 C 1050 102, 1100 118, 1136 128"
              fill="none"
              stroke="rgba(255,255,255,.45)"
              strokeWidth="1.3"
            />
            <path
              d="M 64 150 C 100 154, 130 162, 170 168 C 220 176, 250 192, 300 200 C 340 206, 380 208, 420 204
                 C 470 200, 500 216, 560 224 C 620 232, 660 230, 700 220 C 740 210, 770 190, 820 182
                 C 880 172, 930 178, 990 188 C 1050 198, 1100 182, 1136 172"
              fill="none"
              stroke="rgba(255,255,255,.28)"
              strokeWidth="1"
            />

            {/* section boundaries + labels */}
            <g stroke="rgba(255,255,255,.14)" strokeDasharray="2 5">
              <line x1="240" y1="88" x2="240" y2="228" />
              <line x1="470" y1="88" x2="470" y2="228" />
              <line x1="760" y1="88" x2="760" y2="228" />
              <line x1="960" y1="88" x2="960" y2="228" />
            </g>
            <g fontSize="7" letterSpacing="1.2" fill="rgba(185,185,185,.55)">
              <text x="72" y="244">{t('catalogueIntelligence.figures.intro')}</text>
              <text x="248" y="244">{t('catalogueIntelligence.figures.build')}</text>
              <text x="478" y="244" fill="rgba(238,74,38,.8)">{t('catalogueIntelligence.figures.drop')}</text>
              <text x="768" y="244">{t('catalogueIntelligence.figures.break')}</text>
              <text x="968" y="244">{t('catalogueIntelligence.figures.outro')}</text>
            </g>
            <rect x="470" y="250" width="290" height="3" fill="rgba(238,74,38,.4)" />

            {/* energy journey */}
            <text x="64" y="278" fontSize="7" letterSpacing="1.2" fill="rgba(185,185,185,.5)">
              {t('catalogueIntelligence.figures.energyJourney')}
            </text>
            <path
              d="M 150 282 C 260 278, 360 268, 470 256 C 540 250, 620 248, 700 254 C 800 260, 940 272, 1136 278"
              fill="none"
              stroke="rgba(255,255,255,.4)"
              strokeWidth="1.1"
            />
            <circle cx="590" cy="250" r="2.6" fill="#EE4A26" />

            {/* fields */}
            <g fontSize="7.5" letterSpacing="1.2">
              <rect x="64" y="94" width="118" height="24" fill="none" stroke="rgba(255,255,255,.14)" />
              <text x="72" y="104" fill="rgba(185,185,185,.5)">{t('catalogueIntelligence.figures.tempo')}</text>
              <text x="72" y="114" fill="rgba(255,255,255,.85)">{t('catalogueIntelligence.figures.bpm124Steady')}</text>
              <rect x="64" y="122" width="118" height="24" fill="none" stroke="rgba(255,255,255,.14)" />
              <text x="72" y="132" fill="rgba(185,185,185,.5)">{t('catalogueIntelligence.figures.harmonic')}</text>
              <text x="72" y="142" fill="rgba(255,255,255,.85)">{t('catalogueIntelligence.figures.gMinor6a')}</text>
            </g>

            {/* timbre / spectral */}
            <text x="1010" y="94" fontSize="7" letterSpacing="1.2" fill="rgba(185,185,185,.5)">
              {t('catalogueIntelligence.figures.timbreSpectral')}
            </text>
            <g fill="rgba(255,255,255,.4)">
              <rect x="1010" y="100" width="126" height="4" />
              <rect x="1010" y="110" width="84" height="4" />
              <rect x="1010" y="120" width="104" height="4" />
              <rect x="1010" y="130" width="62" height="4" />
            </g>
            <text x="64" y="306" fontSize="8" letterSpacing="1.5" fill="rgba(238,74,38,.85)">
              {t('catalogueIntelligence.figures.viewFullTi')}
            </text>
          </svg>

          {/* ================= TRACK INTELLIGENCE PANEL · MOBILE ================= */}
          <svg
            className="ci-m-only"
            viewBox="0 0 390 420"
            role="img"
            aria-label={t('catalogueIntelligence.trackIntel.figureAriaM')}
          >
            <rect x="16" y="16" width="358" height="388" fill="#121213" stroke="rgba(255,255,255,.12)" />
            <text x="32" y="44" fontSize="9" letterSpacing="1.6" fill="rgba(255,255,255,.92)">
              {t('catalogueIntelligence.figures.stillCurrent')}
            </text>
            <text x="32" y="58" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.5)">
              {t('catalogueIntelligence.figures.processedRecordingShort')}
            </text>
            <path
              d="M 32 122 C 70 116, 100 104, 140 96 C 180 88, 220 84, 250 92 C 290 102, 320 110, 358 104"
              fill="none"
              stroke="rgba(255,255,255,.45)"
              strokeWidth="1.2"
            />
            <path
              d="M 32 122 C 70 128, 100 140, 140 148 C 180 156, 220 160, 250 152 C 290 142, 320 134, 358 140"
              fill="none"
              stroke="rgba(255,255,255,.28)"
            />
            <g stroke="rgba(255,255,255,.14)" strokeDasharray="2 5">
              <line x1="110" y1="84" x2="110" y2="162" />
              <line x1="196" y1="84" x2="196" y2="162" />
              <line x1="290" y1="84" x2="290" y2="162" />
            </g>
            <g fontSize="6.5" letterSpacing="1" fill="rgba(185,185,185,.55)">
              <text x="36" y="176">{t('catalogueIntelligence.figures.intro')}</text>
              <text x="116" y="176">{t('catalogueIntelligence.figures.build')}</text>
              <text x="202" y="176" fill="rgba(238,74,38,.8)">{t('catalogueIntelligence.figures.drop')}</text>
              <text x="296" y="176">{t('catalogueIntelligence.figures.outro')}</text>
            </g>
            <text x="32" y="206" fontSize="6.5" letterSpacing="1" fill="rgba(185,185,185,.5)">
              {t('catalogueIntelligence.figures.energyJourney')}
            </text>
            <path
              d="M 32 236 C 100 230, 160 216, 220 212 C 270 210, 320 220, 358 228"
              fill="none"
              stroke="rgba(255,255,255,.4)"
            />
            <circle cx="226" cy="212" r="2.4" fill="#EE4A26" />
            <g fontSize="7" letterSpacing="1">
              <rect x="32" y="256" width="150" height="26" fill="none" stroke="rgba(255,255,255,.14)" />
              <text x="40" y="267" fill="rgba(185,185,185,.5)">{t('catalogueIntelligence.figures.tempo')}</text>
              <text x="40" y="278" fill="rgba(255,255,255,.85)">{t('catalogueIntelligence.figures.bpm124Steady')}</text>
              <rect x="192" y="256" width="166" height="26" fill="none" stroke="rgba(255,255,255,.14)" />
              <text x="200" y="267" fill="rgba(185,185,185,.5)">{t('catalogueIntelligence.figures.harmonic')}</text>
              <text x="200" y="278" fill="rgba(255,255,255,.85)">{t('catalogueIntelligence.figures.gMinor6a')}</text>
            </g>
            <text x="32" y="308" fontSize="6.5" letterSpacing="1" fill="rgba(185,185,185,.5)">
              {t('catalogueIntelligence.figures.timbreSpectral')}
            </text>
            <g fill="rgba(255,255,255,.4)">
              <rect x="32" y="316" width="180" height="4" />
              <rect x="32" y="326" width="120" height="4" />
              <rect x="32" y="336" width="150" height="4" />
              <rect x="32" y="346" width="90" height="4" />
            </g>
            <text x="32" y="384" fontSize="7.5" letterSpacing="1.2" fill="rgba(238,74,38,.85)">
              {t('catalogueIntelligence.figures.viewFullTi')}
            </text>
          </svg>
        </div>

        <div className="ci-fig-caption">
          <span>{t('catalogueIntelligence.trackIntel.captionA')}</span>
          <span>{t('catalogueIntelligence.trackIntel.captionB')}</span>
        </div>
      </div>
    </section>
  );
}
