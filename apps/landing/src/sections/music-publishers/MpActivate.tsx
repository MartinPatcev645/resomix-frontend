import { useTranslation } from 'react-i18next';
import { useMpDefs } from './mpDefs.ts';

/* S4 · Activate the catalogue with PYXIS-1 — two-lane flow. */
export function MpActivate() {
  const { t } = useTranslation('common');
  const { url } = useMpDefs();

  return (
    <section className="mp-sec mp-section" id="mp-s4">
      <div className="mp-wrap">
        <div className="mp-eyebrow">{t('musicPublishers.activate.eyebrow')}</div>
        <h2 className="mp-h2">{t('musicPublishers.activate.h2')}</h2>
        <div className="mp-copycol">
          <p className="mp-body-p">{t('musicPublishers.activate.p1')}</p>
          <p className="mp-body-p">{t('musicPublishers.activate.p2')}</p>
        </div>
      </div>

      <div className="mp-wrap mp-bleed mp-fig">
        <div className="mp-stagebox">
          <div className="mp-grain" aria-hidden="true" />

          {/* ============ TWO-LANE FLOW · DESKTOP ============ */}
          <svg
            className="mp-d-only"
            viewBox="0 0 1200 400"
            role="img"
            aria-label={t('musicPublishers.activate.figureAriaD')}
          >
            {/* lane titles */}
            <text x="60" y="40" fontSize="8" letterSpacing="2" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.preparationOnce')}
            </text>
            <text x="60" y="252" fontSize="8" letterSpacing="2" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.opportunityPerRef')}
            </text>

            {/* lane A */}
            <path d="M 60 62 h 176 l 10 10 v 50 h -186 z" fill="#151516" stroke="rgba(255,255,255,.14)" />
            <text x="74" y="92" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.authorised')}
            </text>
            <text x="74" y="106" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.catalogueAudio')}
            </text>
            <line x1="246" y1="92" x2="326" y2="92" stroke="rgba(255,255,255,.3)" />

            {/* profiling node: five spokes */}
            <circle
              cx="382"
              cy="92"
              r="52"
              fill="none"
              stroke="rgba(255,255,255,.2)"
              strokeDasharray="205 122"
              transform="rotate(159 382 92)"
            />
            <circle cx="382" cy="92" r="3.6" fill="#EE4A26" />
            <g stroke="rgba(255,255,255,.32)">
              <line x1="382" y1="92" x2="356" y2="56" />
              <line x1="382" y1="92" x2="418" y2="62" />
              <line x1="382" y1="92" x2="424" y2="112" />
              <line x1="382" y1="92" x2="356" y2="124" />
              <line x1="382" y1="92" x2="338" y2="92" />
            </g>
            <circle cx="356" cy="56" r="2.2" fill="rgba(255,255,255,.8)" />
            <circle cx="418" cy="62" r="2" fill="rgba(255,255,255,.7)" />
            <circle cx="424" cy="112" r="2.2" fill="rgba(255,255,255,.75)" />
            <circle cx="356" cy="124" r="2" fill="rgba(255,255,255,.65)" />
            <circle cx="338" cy="92" r="2.2" fill="rgba(255,255,255,.75)" />
            <text x="352" y="46" fontSize="6.8" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.rhythm')}
            </text>
            <text x="428" y="56" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.harmony')}
            </text>
            <text x="432" y="118" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.timbre')}
            </text>
            <text x="352" y="140" fontSize="6.8" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.structure')}
            </text>
            <text x="326" y="84" fontSize="6.8" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.energy')}
            </text>
            <text x="382" y="26" fontSize="9" letterSpacing="2" textAnchor="middle" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.pyxisSonicProfiling')}
            </text>
            <rect x="298" y="152" width="170" height="17" fill="none" stroke="rgba(255,255,255,.16)" />
            <text x="383" y="164" fontSize="7" letterSpacing="1.2" textAnchor="middle" fill="rgba(185,185,185,.6)">
              {t('musicPublishers.figures.seventyPlus')}
            </text>

            <line x1="438" y1="92" x2="534" y2="92" stroke="rgba(255,255,255,.3)" />

            {/* the partner-scoped index (lanes meet here) */}
            <g>
              <rect x="534" y="42" width="300" height="220" fill="none" stroke="rgba(255,255,255,.18)" strokeDasharray="2 6" />
              <g stroke="rgba(255,255,255,.36)" fill="none">
                <path d="M 534 56 V 42 H 548" />
                <path d="M 820 42 H 834 V 56" />
                <path d="M 534 248 V 262 H 548" />
                <path d="M 820 262 H 834 V 248" />
              </g>
              <rect x="548" y="58" width="272" height="190" fill={url('cellsF')} />
              <text x="534" y="290" fontSize="9.5" letterSpacing="2" fill="rgba(255,255,255,.9)">
                {t('musicPublishers.figures.partnerScopedIndex')}
              </text>
              <text x="534" y="306" fontSize="7.5" letterSpacing="1.2" fill="rgba(185,185,185,.5)">
                {t('musicPublishers.figures.profiledOnce')}
              </text>
            </g>

            {/* lane B */}
            <circle cx="152" cy="316" r="18" fill={url('haloA')} />
            <circle cx="152" cy="316" r="8" fill="none" stroke="rgba(238,74,38,.55)" />
            <circle cx="152" cy="316" r="3.4" fill="#EE4A26" />
            <text x="60" y="320" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.reference')}
            </text>
            <text x="60" y="334" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.recording')}
            </text>
            <path className="sig" d="M 164 316 H 300" fill="none" stroke="#EE4A26" strokeWidth="1.6" />

            <g>
              <line x1="330" y1="290" x2="330" y2="342" stroke="rgba(255,255,255,.3)" />
              <line x1="304" y1="316" x2="356" y2="316" stroke="rgba(255,255,255,.3)" />
              <circle
                cx="330"
                cy="316"
                r="15"
                fill="none"
                stroke="rgba(255,255,255,.35)"
                strokeDasharray="60 34"
                transform="rotate(30 330 316)"
              />
              <rect
                x="325"
                y="311"
                width="10"
                height="10"
                fill="#151516"
                stroke="rgba(238,74,38,.85)"
                transform="rotate(45 330 316)"
              />
            </g>
            <text x="330" y="366" fontSize="8" letterSpacing="1.6" textAnchor="middle" fill="rgba(255,255,255,.8)">
              {t('musicPublishers.figures.pyxisComparison')}
            </text>

            <path
              className="sig"
              d="M 346 316 C 430 316, 470 300, 534 268"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />

            {/* results out of the index */}
            <path className="sig" d="M 834 152 H 902" fill="none" stroke="#EE4A26" strokeWidth="1.6" />
            <g className="resolve d1">
              <rect x="912" y="118" width="20" height="12" fill="rgba(255,255,255,.92)" />
              <rect x="908" y="114" width="28" height="20" fill="none" stroke="rgba(238,74,38,.8)" />
              <text x="948" y="128" fontSize="7.5" letterSpacing="1" fill="rgba(185,185,185,.6)">
                {t('musicPublishers.figures.wrk0447RecA')}
              </text>
            </g>
            <g className="resolve d2">
              <rect x="912" y="146" width="20" height="12" fill="rgba(255,255,255,.8)" />
              <text x="948" y="156" fontSize="7.5" letterSpacing="1" fill="rgba(185,185,185,.55)">
                {t('musicPublishers.figures.wrk1180RecA')}
              </text>
            </g>
            <g className="resolve d3">
              <rect x="912" y="174" width="20" height="12" fill="rgba(255,255,255,.72)" />
              <text x="948" y="184" fontSize="7.5" letterSpacing="1" fill="rgba(185,185,185,.5)">
                {t('musicPublishers.figures.wrk0921RecB')}
              </text>
            </g>
            <text x="908" y="102" fontSize="9" letterSpacing="1.8" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.relevantRepresentedWorks')}
            </text>
          </svg>

          {/* ============ TWO-LANE FLOW · MOBILE ============ */}
          <svg
            className="mp-m-only"
            viewBox="0 0 390 640"
            role="img"
            aria-label={t('musicPublishers.activate.figureAriaM')}
          >
            <text x="24" y="24" fontSize="7.5" letterSpacing="1.6" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.preparationOnce')}
            </text>
            <path d="M 24 36 h 150 l 8 8 v 38 h -158 z" fill="#151516" stroke="rgba(255,255,255,.14)" />
            <text x="34" y="58" fontSize="7.6" letterSpacing="1" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.authorised')}
            </text>
            <text x="34" y="71" fontSize="7.6" letterSpacing="1" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.catalogueAudio')}
            </text>
            <line x1="102" y1="82" x2="102" y2="112" stroke="rgba(255,255,255,.3)" />

            <circle
              cx="102"
              cy="158"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,.2)"
              strokeDasharray="158 94"
              transform="rotate(159 102 158)"
            />
            <circle cx="102" cy="158" r="3" fill="#EE4A26" />
            <g stroke="rgba(255,255,255,.32)">
              <line x1="102" y1="158" x2="82" y2="130" />
              <line x1="102" y1="158" x2="130" y2="136" />
              <line x1="102" y1="158" x2="134" y2="172" />
              <line x1="102" y1="158" x2="80" y2="182" />
              <line x1="102" y1="158" x2="68" y2="158" />
            </g>
            <text x="160" y="150" fontSize="8" letterSpacing="1.4" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.pyxis')}
            </text>
            <text x="160" y="164" fontSize="8" letterSpacing="1.4" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.sonicProfiling')}
            </text>
            <text x="160" y="180" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.6)">
              {t('musicPublishers.figures.seventyPlus')}
            </text>
            <line x1="102" y1="200" x2="102" y2="232" stroke="rgba(255,255,255,.3)" />

            <text x="24" y="252" fontSize="7.5" letterSpacing="1.6" fill="rgba(185,185,185,.55)">
              {t('musicPublishers.figures.opportunityPerRef')}
            </text>
            <circle cx="298" cy="286" r="14" fill={url('haloAm')} />
            <circle cx="298" cy="286" r="3" fill="#EE4A26" />
            <text x="366" y="266" fontSize="7.6" letterSpacing="1" textAnchor="end" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.referenceRecording')}
            </text>
            <path
              className="sig"
              d="M 298 300 C 298 322, 260 334, 230 344"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.5"
            />

            <rect x="52" y="330" width="240" height="170" fill="none" stroke="rgba(255,255,255,.18)" strokeDasharray="2 6" />
            <g stroke="rgba(255,255,255,.36)" fill="none">
              <path d="M 52 342 V 330 H 64" />
              <path d="M 280 330 H 292 V 342" />
              <path d="M 52 488 V 500 H 64" />
              <path d="M 280 500 H 292 V 488" />
            </g>
            <rect x="64" y="342" width="216" height="146" fill={url('cellsF')} />
            <text x="52" y="522" fontSize="8.5" letterSpacing="1.6" fill="rgba(255,255,255,.9)">
              {t('musicPublishers.figures.partnerScopedIndex')}
            </text>
            <text x="52" y="536" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.5)">
              {t('musicPublishers.figures.profiledOnce')}
            </text>

            <path className="sig" d="M 172 500 V 556" fill="none" stroke="#EE4A26" strokeWidth="1.5" />
            <g className="resolve d1">
              <rect x="120" y="566" width="18" height="11" fill="rgba(255,255,255,.92)" />
              <rect x="116" y="562" width="26" height="19" fill="none" stroke="rgba(238,74,38,.8)" />
            </g>
            <g className="resolve d2">
              <rect x="164" y="566" width="18" height="11" fill="rgba(255,255,255,.8)" />
            </g>
            <g className="resolve d3">
              <rect x="208" y="566" width="18" height="11" fill="rgba(255,255,255,.72)" />
            </g>
            <text x="195" y="608" fontSize="8" letterSpacing="1.4" textAnchor="middle" fill="rgba(255,255,255,.88)">
              {t('musicPublishers.figures.relevantRepresentedWorks')}
            </text>
          </svg>
        </div>

        <div className="mp-fig-caption mp-trust-rail">
          <span>{t('musicPublishers.activate.trust1')}</span>
          <span>{t('musicPublishers.activate.trust2')}</span>
          <span>{t('musicPublishers.activate.trust3')}</span>
          <span>{t('musicPublishers.activate.trust4')}</span>
        </div>
      </div>
    </section>
  );
}
