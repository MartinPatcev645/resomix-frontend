import { useTranslation } from 'react-i18next';
import { useAbDefs } from './abDefs.ts';

/* S5 · Vision — occluded-recording scene: a known reference (01) relates
   sonically (02) to a low-exposure recording (03) that surfaces as a ranked
   candidate (04). Geometry transplanted verbatim from the approved preview
   (`#ab-s5`). */
export function AbVision() {
  const { t } = useTranslation('common');
  const { url } = useAbDefs();
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-sec ab-section" id="ab-s5">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.vision.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.vision.h2')}</h2>
        <div className="ab-copycol">
          <p className="ab-body-p">{t('about.vision.body1')}</p>
          <p className="ab-body-p">{t('about.vision.body2')}</p>
        </div>
        <p className="ab-big-statement">{t('about.vision.statement')}</p>
      </div>

      <div className="ab-wrap ab-bleed ab-fig">
        <div className="ab-stagebox">
          <div className="ab-grain" aria-hidden="true" />

          <svg className="ab-d-only" viewBox="0 0 1200 400" role="img" aria-label={t('about.vision.figureAriaD')}>
            <g className="ab-plx" data-plx="0.15">
              <circle cx="1180" cy="200" r="132" fill="#0A0A0B" stroke="rgba(255,255,255,.14)" />
              <path
                d="M 1074 118 A 132 132 0 0 0 1074 282"
                fill="none"
                stroke="rgba(238,74,38,.65)"
                strokeWidth="2.2"
                className="ab-breathe"
              />
            </g>
            <text x="1044" y="66" fontSize="10" letterSpacing="1.4" textAnchor="end" fill="rgba(255,255,255,.94)">
              <tspan fill="#EE4A26">03 · </tspan>LOW-EXPOSURE RECORDING
            </text>

            <circle cx="150" cy="200" r="24" fill={url('halo')} />
            <rect x="137" y="193" width="26" height="15" fill="#EE4A26" />
            <line x1="142" y1="200" x2="158" y2="200" stroke="#101010" />
            <text x="150" y="156" fontSize="10" letterSpacing="1.4" textAnchor="middle" fill="rgba(255,255,255,.96)">
              <tspan fill="#EE4A26">01 · </tspan>KNOWN REFERENCE
            </text>

            <path className="ab-sig" d="M 166 200 C 400 176, 700 176, 1046 196" fill="none" stroke="#EE4A26" />
            <text
              x="560"
              y="164"
              fontSize="9.5"
              letterSpacing="1.4"
              textAnchor="middle"
              fill="rgba(185,185,185,.92)"
            >
              <tspan fill="#EE4A26">02 · </tspan>SONICALLY RELEVANT TO THE REFERENCE
            </text>

            <g>
              <rect x="418" y="234" width="340" height="130" fill="#1C1C1F" stroke="rgba(255,255,255,.38)" />
              <text x="434" y="256" fontSize="10" letterSpacing="1.4" fill="rgba(255,255,255,.94)">
                {f('rankedCandidates')}
              </text>
              <g fontSize="10.5" letterSpacing="1">
                <text x="446" y="266" fill="rgba(255,255,255,.72)">
                  {f('rank01')}
                </text>
                <text x="478" y="266" fill="rgba(255,255,255,.9)">
                  {f('cat2201_2026')}
                </text>
                <text x="446" y="292" fill="rgba(255,255,255,.68)">
                  {f('rank02')}
                </text>
                <text x="478" y="292" fill="rgba(255,255,255,.86)">
                  {f('cat1121_2024')}
                </text>
                <g className="ab-resolve d3">
                  <rect x="438" y="302" width="284" height="22" fill="rgba(238,74,38,.12)" />
                  <text x="446" y="317" fill="#EE4A26">
                    {f('rank03')}
                  </text>
                  <text x="478" y="317" fill="rgba(255,255,255,.95)">
                    {f('cat0417_2011')}
                  </text>
                  <text x="714" y="317" textAnchor="end" fill="rgba(238,74,38,.9)">
                    {f('score926')}
                  </text>
                </g>
                <text x="446" y="344" fill="rgba(255,255,255,.62)">
                  {f('rank04')}
                </text>
                <text x="478" y="344" fill="rgba(255,255,255,.8)">
                  {f('rec1c44_2023')}
                </text>
              </g>
            </g>
            <path className="ab-sig" d="M 1052 232 C 960 260, 870 276, 762 290" fill="none" stroke="#EE4A26" />
            <text x="418" y="384" fontSize="9.5" letterSpacing="1.4" fill="rgba(185,185,185,.92)">
              <tspan fill="#EE4A26">04 · </tspan>SURFACED AS A RANKED CANDIDATE
            </text>
            <text x="40" y="382" fontSize="9" letterSpacing="1.2" fill="rgba(185,185,185,.6)">
              {f('discoveryRouteNotForecast')}
            </text>
          </svg>

          <svg className="ab-m-only" viewBox="0 0 390 470" role="img" aria-label={t('about.vision.figureAriaM')}>
            <circle cx="336" cy="84" r="86" fill="#0A0A0B" stroke="rgba(255,255,255,.14)" />
            <path d="M 268 32 A 86 86 0 0 0 268 136" fill="none" stroke="rgba(238,74,38,.65)" strokeWidth="2" />
            <text x="24" y="40" fontSize="12.3" letterSpacing="1" fill="rgba(255,255,255,.9)">
              {f('lowExposureM')}
            </text>
            <text x="24" y="56" fontSize="12.3" letterSpacing="1" fill="rgba(255,255,255,.9)">
              {f('recording')}
            </text>
            <circle cx="60" cy="140" r="18" fill={url('halo')} />
            <rect x="49" y="134" width="22" height="13" fill="#EE4A26" />
            <text x="84" y="145" fontSize="12.5" letterSpacing="1" fill="rgba(255,255,255,.94)">
              {f('knownReferenceM')}
            </text>
            <path className="ab-sig" d="M 74 148 C 140 168, 200 160, 242 128" fill="none" stroke="#EE4A26" />
            <text x="24" y="196" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">
              {f('sonicallyRelevantM')}
            </text>
            <path className="ab-sig" d="M 195 206 V 236" fill="none" stroke="#EE4A26" />
            <rect x="24" y="244" width="342" height="150" fill="#1C1C1F" stroke="rgba(255,255,255,.34)" />
            <g fontSize="12.4" letterSpacing=".9">
              <text x="40" y="274" fill="rgba(255,255,255,.72)">
                {f('rank01')}
              </text>
              <text x="74" y="274" fill="rgba(255,255,255,.9)">
                {f('cat2201_2026')}
              </text>
              <text x="40" y="304" fill="rgba(255,255,255,.68)">
                {f('rank02')}
              </text>
              <text x="74" y="304" fill="rgba(255,255,255,.86)">
                {f('cat1121_2024')}
              </text>
              <g className="ab-resolve d3">
                <rect x="32" y="316" width="326" height="24" fill="rgba(238,74,38,.12)" />
                <text x="40" y="333" fill="#EE4A26">
                  {f('rank03')}
                </text>
                <text x="74" y="333" fill="rgba(255,255,255,.95)">
                  {f('cat0417_2011')}
                </text>
                <text x="350" y="333" textAnchor="end" fill="rgba(238,74,38,.9)">
                  {f('score926')}
                </text>
              </g>
              <text x="40" y="366" fill="rgba(255,255,255,.62)">
                {f('rank04')}
              </text>
              <text x="74" y="366" fill="rgba(255,255,255,.8)">
                {f('rec1c44_2023')}
              </text>
            </g>
            <text x="24" y="420" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">
              {f('surfacedAsRankedM')}
            </text>
            <text x="24" y="446" fontSize="12.3" letterSpacing=".8" fill="rgba(185,185,185,.6)">
              {f('discoveryRouteM')}
            </text>
            <text x="24" y="462" fontSize="12.3" letterSpacing=".8" fill="rgba(185,185,185,.6)">
              {f('notForecastM')}
            </text>
          </svg>
        </div>
        <p className="ab-interp">{t('about.vision.interp')}</p>
      </div>
    </section>
  );
}
