import { useTranslation } from 'react-i18next';

/* S6 · The cross-era discovery moment. */
export function MpCrossEra() {
  const { t } = useTranslation('common');

  return (
    <section className="mp-sec mp-section" id="mp-s6">
      <div className="mp-wrap">
        <div className="mp-copycol">
          <p className="mp-body-p mp-lead-white">{t('musicPublishers.crossEra.lead')}</p>
        </div>
      </div>

      <div className="mp-wrap mp-bleed mp-fig">
        <div className="mp-stagebox">
          <div className="mp-grain" aria-hidden="true" />

          {/* ============ CROSS-ERA · DESKTOP ============ */}
          <svg
            className="mp-d-only"
            viewBox="0 0 1200 400"
            role="img"
            aria-label={t('musicPublishers.crossEra.figureAriaD')}
          >
            <line x1="80" y1="330" x2="1120" y2="330" stroke="rgba(255,255,255,.1)" />
            <g stroke="rgba(255,255,255,.14)">
              <line x1="80" y1="324" x2="80" y2="336" />
              <line x1="340" y1="326" x2="340" y2="334" />
              <line x1="600" y1="324" x2="600" y2="336" />
              <line x1="860" y1="326" x2="860" y2="334" />
              <line x1="1120" y1="324" x2="1120" y2="336" />
            </g>
            <text x="80" y="352" fontSize="7.5" letterSpacing="1.5" fill="rgba(185,185,185,.4)">
              {t('musicPublishers.figures.releaseDateEarlier')}
            </text>
            <text x="1120" y="352" fontSize="7.5" letterSpacing="1.5" textAnchor="end" fill="rgba(185,185,185,.4)">
              {t('musicPublishers.figures.recent')}
            </text>

            {/* older work record */}
            <g>
              <rect x="120" y="120" width="190" height="110" fill="#151516" stroke="rgba(255,255,255,.16)" />
              <rect x="138" y="142" width="34" height="20" fill="rgba(255,255,255,.62)" />
              <line x1="143" y1="152" x2="167" y2="152" stroke="#101010" />
              <text x="138" y="186" fontSize="8.5" letterSpacing="1.2" fill="rgba(255,255,255,.85)">
                {t('musicPublishers.figures.wrk0447RecA')}
              </text>
              <text x="138" y="202" fontSize="7" letterSpacing="1" fill="rgba(185,185,185,.5)">
                {t('musicPublishers.figures.entry2011Represented')}
              </text>
              <text x="120" y="108" fontSize="8.5" letterSpacing="1.6" fill="rgba(185,185,185,.65)">
                {t('musicPublishers.figures.olderWorkUnderexposed')}
              </text>
              <line x1="215" y1="230" x2="215" y2="330" stroke="rgba(255,255,255,.1)" strokeDasharray="2 5" />
            </g>

            {/* recent record */}
            <g>
              <rect x="890" y="120" width="190" height="110" fill="#151516" stroke="rgba(238,74,38,.5)" />
              <rect x="908" y="142" width="34" height="20" fill="rgba(255,255,255,.92)" />
              <line x1="913" y1="152" x2="937" y2="152" stroke="#101010" />
              <circle cx="1056" cy="138" r="4" fill="#EE4A26" />
              <text x="908" y="186" fontSize="8.5" letterSpacing="1.2" fill="rgba(255,255,255,.85)">
                {t('musicPublishers.figures.wrk2201RecA')}
              </text>
              <text x="908" y="202" fontSize="7" letterSpacing="1" fill="rgba(185,185,185,.5)">
                {t('musicPublishers.figures.entry2026Represented')}
              </text>
              <text x="1080" y="108" fontSize="8.5" letterSpacing="1.6" textAnchor="end" fill="rgba(185,185,185,.65)">
                {t('musicPublishers.figures.recentReleaseActive')}
              </text>
              <line x1="985" y1="230" x2="985" y2="330" stroke="rgba(255,255,255,.1)" strokeDasharray="2 5" />
            </g>

            {/* central relationship profile */}
            <path
              className="sig"
              d="M 890 172 C 800 172, 740 172, 668 172"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />
            <path
              className="sig"
              d="M 532 172 C 460 172, 396 172, 310 172"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />
            <g>
              <circle
                cx="600"
                cy="172"
                r="64"
                fill="none"
                stroke="rgba(255,255,255,.22)"
                strokeDasharray="250 152"
                transform="rotate(159 600 172)"
              />
              <rect
                x="594"
                y="166"
                width="12"
                height="12"
                fill="#0C0C0D"
                stroke="rgba(238,74,38,.85)"
                transform="rotate(45 600 172)"
              />
              <g stroke="rgba(255,255,255,.3)">
                <line x1="600" y1="172" x2="572" y2="126" />
                <line x1="600" y1="172" x2="642" y2="136" />
                <line x1="600" y1="172" x2="648" y2="196" />
                <line x1="600" y1="172" x2="568" y2="210" />
                <line x1="600" y1="172" x2="548" y2="164" />
              </g>
              <text x="568" y="116" fontSize="6.8" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.55)">
                {t('musicPublishers.figures.rhythm')}
              </text>
              <text x="652" y="130" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
                {t('musicPublishers.figures.harmony')}
              </text>
              <text x="656" y="202" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
                {t('musicPublishers.figures.timbre')}
              </text>
              <text x="566" y="226" fontSize="6.8" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.55)">
                {t('musicPublishers.figures.structure')}
              </text>
              <text x="536" y="156" fontSize="6.8" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.55)">
                {t('musicPublishers.figures.energy')}
              </text>
              <text x="600" y="66" fontSize="9" letterSpacing="2" textAnchor="middle" fill="rgba(255,255,255,.88)">
                {t('musicPublishers.figures.pyxisRelationshipProfile')}
              </text>
            </g>

            {/* related group revealed */}
            <g className="resolve d2">
              <rect x="452" y="252" width="18" height="11" fill="rgba(255,255,255,.7)" />
              <line x1="561" y1="212" x2="470" y2="254" stroke="rgba(255,255,255,.16)" />
            </g>
            <g className="resolve d3">
              <rect x="662" y="262" width="18" height="11" fill="rgba(255,255,255,.66)" />
              <line x1="638" y1="214" x2="672" y2="260" stroke="rgba(255,255,255,.16)" />
            </g>
            <g className="resolve d4">
              <rect x="556" y="286" width="18" height="11" fill="rgba(255,255,255,.6)" />
              <line x1="592" y1="238" x2="566" y2="286" stroke="rgba(255,255,255,.14)" />
            </g>
            <g className="resolve d5">
              <rect x="756" y="236" width="18" height="11" fill="rgba(255,255,255,.6)" />
              <line x1="660" y1="196" x2="756" y2="240" stroke="rgba(255,255,255,.14)" />
            </g>
            <text
              x="600"
              y="316"
              fontSize="7.5"
              letterSpacing="1.4"
              textAnchor="middle"
              fill="rgba(185,185,185,.55)"
              className="resolve d5"
            >
              {t('musicPublishers.figures.additionalRelatedWorks')}
            </text>
          </svg>

          {/* ============ CROSS-ERA · MOBILE ============ */}
          <svg
            className="mp-m-only"
            viewBox="0 0 390 600"
            role="img"
            aria-label={t('musicPublishers.crossEra.figureAriaM')}
          >
            <text x="24" y="24" fontSize="8" letterSpacing="1.4" fill="rgba(185,185,185,.65)">
              {t('musicPublishers.figures.recentReleaseActive')}
            </text>
            <rect x="24" y="34" width="342" height="86" fill="#151516" stroke="rgba(238,74,38,.5)" />
            <rect x="40" y="52" width="30" height="18" fill="rgba(255,255,255,.92)" />
            <line x1="45" y1="61" x2="65" y2="61" stroke="#101010" />
            <text x="84" y="60" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.85)">
              {t('musicPublishers.figures.wrk2201RecA')}
            </text>
            <text x="84" y="74" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.5)">
              {t('musicPublishers.figures.entry2026')}
            </text>
            <circle cx="344" cy="52" r="4" fill="#EE4A26" />

            <path className="sig" d="M 195 120 V 168" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            <circle
              cx="195"
              cy="242"
              r="58"
              fill="none"
              stroke="rgba(255,255,255,.22)"
              strokeDasharray="228 136"
              transform="rotate(159 195 242)"
            />
            <rect
              x="189"
              y="236"
              width="12"
              height="12"
              fill="#0C0C0D"
              stroke="rgba(238,74,38,.85)"
              transform="rotate(45 195 242)"
            />
            <g stroke="rgba(255,255,255,.3)">
              <line x1="195" y1="242" x2="170" y2="202" />
              <line x1="195" y1="242" x2="232" y2="212" />
              <line x1="195" y1="242" x2="238" y2="262" />
              <line x1="195" y1="242" x2="166" y2="276" />
              <line x1="195" y1="242" x2="148" y2="236" />
            </g>
            <text x="166" y="194" fontSize="6.8" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.rhythm')}
            </text>
            <text x="242" y="206" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.harmony')}
            </text>
            <text x="246" y="268" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.timbre')}
            </text>
            <text x="164" y="292" fontSize="6.8" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.structure')}
            </text>
            <text x="136" y="228" fontSize="6.8" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.energy')}
            </text>
            <text x="195" y="330" fontSize="8" letterSpacing="1.6" textAnchor="middle" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.pyxisRelationshipProfile')}
            </text>

            <path className="sig" d="M 195 344 V 392" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            <text x="24" y="416" fontSize="8" letterSpacing="1.4" fill="rgba(185,185,185,.65)">
              {t('musicPublishers.figures.olderWorkUnderexposed')}
            </text>
            <rect x="24" y="426" width="342" height="86" fill="#151516" stroke="rgba(255,255,255,.16)" />
            <rect x="40" y="444" width="30" height="18" fill="rgba(255,255,255,.62)" />
            <line x1="45" y1="453" x2="65" y2="453" stroke="#101010" />
            <text x="84" y="452" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.85)">
              {t('musicPublishers.figures.wrk0447RecA')}
            </text>
            <text x="84" y="466" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.5)">
              {t('musicPublishers.figures.entry2011')}
            </text>

            <g className="resolve d2">
              <rect x="60" y="540" width="18" height="11" fill="rgba(255,255,255,.7)" />
            </g>
            <g className="resolve d3">
              <rect x="132" y="540" width="18" height="11" fill="rgba(255,255,255,.66)" />
            </g>
            <g className="resolve d4">
              <rect x="204" y="540" width="18" height="11" fill="rgba(255,255,255,.62)" />
            </g>
            <g className="resolve d5">
              <rect x="276" y="540" width="18" height="11" fill="rgba(255,255,255,.6)" />
            </g>
            <text x="195" y="580" fontSize="7.5" letterSpacing="1.4" textAnchor="middle" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.additionalRelatedWorks')}
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
