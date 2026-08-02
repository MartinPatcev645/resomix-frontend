import { useTranslation } from 'react-i18next';

/* S3 · Why Resomix exists — one recording resolves into a sonic profile and
   two possible operations; geometry transplanted verbatim from the approved
   preview (`#ab-s3`). */
export function AbEvidence() {
  const { t } = useTranslation('common');
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-sec ab-section" id="ab-s3">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.evidence.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.evidence.h2')}</h2>
        <div className="ab-copycol">
          <p className="ab-body-p">{t('about.evidence.body1')}</p>
          <p className="ab-body-p">{t('about.evidence.body2')}</p>
          <p className="ab-body-p">{t('about.evidence.body3')}</p>
        </div>
        <div className="ab-status-rail" style={{ marginTop: '1.5rem' }}>
          {t('about.evidence.status')}
        </div>
      </div>

      <div className="ab-wrap ab-bleed ab-fig">
        <div className="ab-stagebox">
          <div className="ab-grain" aria-hidden="true" />

          {/* ============ EVIDENCE FLOW · DESKTOP ============ */}
          <svg className="ab-d-only" viewBox="0 0 1200 320" role="img" aria-label={t('about.evidence.figureAriaD')}>
            <rect x="70" y="140" width="26" height="15" fill="rgba(255,255,255,.9)" />
            <line x1="75" y1="147" x2="91" y2="147" stroke="#101010" />
            <text x="70" y="126" fontSize="10" letterSpacing="1.2" fill="rgba(255,255,255,.94)">
              {f('oneRecording')}
            </text>
            <path className="ab-sig" d="M 100 147 H 166" fill="none" stroke="#EE4A26" />
            <g>
              <rect x="178" y="46" width="280" height="212" fill="rgba(255,255,255,.012)" stroke="rgba(255,255,255,.36)" />
              <g fontSize="9.5" letterSpacing="1.2" fill="rgba(185,185,185,.92)">
                <text x="194" y="76">{f('rhythm')}</text>
                <text x="194" y="116">{f('harmony')}</text>
                <text x="194" y="156">{f('timbre')}</text>
                <text x="194" y="196">{f('structure')}</text>
                <text x="194" y="236">{f('energy')}</text>
              </g>
              <g stroke="rgba(255,255,255,.5)">
                <path
                  d="M 292 72 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5"
                  fill="none"
                />
                <path
                  d="M 292 112 C 312 104, 332 120, 352 112 C 372 104, 392 120, 412 112 C 424 108, 434 112, 438 112"
                  fill="none"
                />
                <path
                  d="M 292 152 C 322 144, 342 162, 372 150 C 402 140, 424 162, 438 152"
                  fill="none"
                  strokeDasharray="3 4"
                />
                <path d="M 292 192 H 318 V 186 H 348 V 198 H 384 V 188 H 414 V 196 H 438" fill="none" />
                <path
                  d="M 292 232 C 330 226, 360 214, 390 210 C 415 208, 430 218, 438 226"
                  fill="none"
                />
              </g>
              <rect x="230" y="270" width="176" height="20" fill="none" stroke="rgba(255,255,255,.36)" />
              <text x="318" y="284" fontSize="9.5" letterSpacing="1.4" textAnchor="middle" fill="rgba(185,185,185,.94)">
                {f('characteristics70')}
              </text>
            </g>
            <path className="ab-sig" d="M 458 147 H 534" fill="none" stroke="#EE4A26" />
            <g>
              <circle
                cx="596"
                cy="147"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,.5)"
                strokeDasharray="164 100"
                transform="rotate(150 596 147)"
              />
              <rect x="576" y="134" width="40" height="26" fill="#17171A" stroke="rgba(238,74,38,.8)" />
              <line x1="584" y1="143" x2="608" y2="143" stroke="rgba(255,255,255,.6)" />
              <line x1="584" y1="151" x2="602" y2="151" stroke="rgba(255,255,255,.35)" />
              <text x="596" y="90" fontSize="10.5" letterSpacing="2" textAnchor="middle" fill="rgba(255,255,255,.96)">
                {f('sonicProfile')}
              </text>
            </g>
            <path className="ab-sig" d="M 638 132 C 700 112, 760 102, 826 96" fill="none" stroke="#EE4A26" />
            <path d="M 638 162 C 700 182, 760 192, 826 198" fill="none" stroke="rgba(255,255,255,.5)" />
            <g>
              <rect x="838" y="64" width="268" height="56" fill="#17171A" stroke="rgba(255,255,255,.34)" />
              <text x="856" y="88" fontSize="9.5" letterSpacing="1.2" fill="rgba(185,185,185,.92)">
                {f('readOneRecording')}
              </text>
              <text x="856" y="106" fontSize="10.5" letterSpacing="1.6" fill="rgba(255,255,255,.95)">
                {f('trackIntelligence')}
              </text>
            </g>
            <g>
              <rect x="838" y="170" width="268" height="56" fill="#17171A" stroke="rgba(255,255,255,.34)" />
              <text x="856" y="194" fontSize="9.5" letterSpacing="1.2" fill="rgba(185,185,185,.92)">
                {f('compareWithAnIndex')}
              </text>
              <text x="856" y="212" fontSize="10.5" letterSpacing="1.6" fill="rgba(255,255,255,.95)">
                {f('rankedSimilarity')}
              </text>
            </g>
            <text x="596" y="300" fontSize="9" letterSpacing="1.4" textAnchor="middle" fill="rgba(185,185,185,.86)">
              {f('twoOperationsNotAutoD')}
            </text>
          </svg>

          {/* ============ EVIDENCE FLOW · MOBILE ============ */}
          <svg className="ab-m-only" viewBox="0 0 390 538" role="img" aria-label={t('about.evidence.figureAriaM')}>
            <rect x="40" y="22" width="22" height="13" fill="rgba(255,255,255,.9)" />
            <text x="74" y="33" fontSize="12.5" letterSpacing="1" fill="rgba(255,255,255,.94)">
              {f('oneRecording')}
            </text>
            <path className="ab-sig" d="M 51 38 V 64" fill="none" stroke="#EE4A26" />
            <rect x="24" y="72" width="342" height="196" fill="rgba(255,255,255,.012)" stroke="rgba(255,255,255,.36)" />
            <g fontSize="12.4" letterSpacing="1" fill="rgba(185,185,185,.92)">
              <text x="38" y="100">{f('rhythm')}</text>
              <text x="38" y="134">{f('harmony')}</text>
              <text x="38" y="168">{f('timbre')}</text>
              <text x="38" y="202">{f('structure')}</text>
              <text x="38" y="236">{f('energy')}</text>
            </g>
            <g stroke="rgba(255,255,255,.5)">
              <path
                d="M 146 96 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5 l 7 -5 l 7 5"
                fill="none"
              />
              <path
                d="M 146 130 C 166 122, 186 138, 206 130 C 226 122, 246 138, 266 130 C 286 122, 306 138, 326 130 C 338 126, 348 130, 352 130"
                fill="none"
              />
              <path
                d="M 146 164 C 176 156, 196 174, 226 162 C 256 152, 300 174, 352 164"
                fill="none"
                strokeDasharray="3 4"
              />
              <path d="M 146 198 H 176 V 192 H 210 V 204 H 254 V 194 H 304 V 202 H 352" fill="none" />
              <path
                d="M 146 232 C 186 226, 226 214, 266 210 C 306 208, 336 220, 352 228"
                fill="none"
              />
            </g>
            <rect x="102" y="246" width="186" height="18" fill="none" stroke="rgba(255,255,255,.36)" />
            <text x="195" y="259" fontSize="12.3" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.94)">
              {f('characteristics70')}
            </text>
            <path className="ab-sig" d="M 195 268 V 296" fill="none" stroke="#EE4A26" />
            <circle
              cx="195"
              cy="332"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,.5)"
              strokeDasharray="132 82"
              transform="rotate(150 195 332)"
            />
            <rect x="177" y="321" width="36" height="22" fill="#17171A" stroke="rgba(238,74,38,.8)" />
            <line x1="184" y1="329" x2="206" y2="329" stroke="rgba(255,255,255,.6)" />
            <text x="244" y="328" fontSize="12.5" letterSpacing="1.2" fill="rgba(255,255,255,.96)">
              {f('sonicM')}
            </text>
            <text x="244" y="344" fontSize="12.5" letterSpacing="1.2" fill="rgba(255,255,255,.96)">
              {f('profileM')}
            </text>
            <path
              className="ab-sig"
              d="M 172 358 C 140 384, 120 398, 108 412"
              fill="none"
              stroke="#EE4A26"
            />
            <path d="M 218 358 C 250 384, 270 398, 282 412" fill="none" stroke="rgba(255,255,255,.5)" />
            <rect x="24" y="420" width="166" height="56" fill="#17171A" stroke="rgba(255,255,255,.34)" />
            <text x="38" y="443" fontSize="12.3" letterSpacing=".8" fill="rgba(185,185,185,.92)">
              {f('readOneRecording')}
            </text>
            <text x="38" y="461" fontSize="12.4" letterSpacing=".9" fill="rgba(255,255,255,.95)">
              {f('trackIntelligence')}
            </text>
            <rect x="200" y="420" width="166" height="56" fill="#17171A" stroke="rgba(255,255,255,.34)" />
            <text x="214" y="443" fontSize="12.3" letterSpacing=".8" fill="rgba(185,185,185,.92)">
              {f('compareWithIndex')}
            </text>
            <text x="214" y="461" fontSize="12.4" letterSpacing=".9" fill="rgba(255,255,255,.95)">
              {f('rankedSimilarity')}
            </text>
            <text x="195" y="500" fontSize="12.3" letterSpacing=".9" textAnchor="middle" fill="rgba(185,185,185,.86)">
              {f('twoOperationsLine1M')}
            </text>
            <text x="195" y="516" fontSize="12.3" letterSpacing=".9" textAnchor="middle" fill="rgba(185,185,185,.86)">
              {f('twoOperationsLine2M')}
            </text>
          </svg>
        </div>
        <p className="ab-interp">{t('about.evidence.interp')}</p>
      </div>
    </section>
  );
}
