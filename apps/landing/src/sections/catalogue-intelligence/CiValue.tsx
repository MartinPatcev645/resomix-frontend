import { useTranslation, Trans } from 'react-i18next';
import { useCiDefs } from './ciDefs.ts';
import { BLOG } from '@/routes/blogLinks.ts';

/* S5 · Catalogue value — sonic relevance as another route into discovery.
   Geometry transplanted verbatim from the approved preview; fictional
   catalogue IDs are hardcoded exactly as in the source. */
export function CiValue() {
  const { t } = useTranslation('common');
  const { url } = useCiDefs();

  return (
    <section className="ci-sec ci-section" id="ci-s5">
      <div className="ci-wrap">
        <div className="ci-eyebrow">{t('catalogueIntelligence.value.eyebrow')}</div>
        <h2 className="ci-h2">{t('catalogueIntelligence.value.h2')}</h2>
        <div className="ci-copycol">
          <p className="ci-body-p"><Trans i18nKey="catalogueIntelligence.value.body1" components={{ a: <a className="rx-copylink" href={BLOG.beyondTags} /> }} /></p>
          <p className="ci-body-p">{t('catalogueIntelligence.value.body2')}</p>
        </div>

        <div className="ci-outputs ci-three">
          <div className="ci-module">
            <div className="ci-tt ci-alt">{t('catalogueIntelligence.value.mod1Title')}</div>
            <p><Trans i18nKey="catalogueIntelligence.value.mod1Body" components={{ a: <a className="rx-copylink" href={BLOG.backCatalogue} /> }} /></p>
          </div>
          <div className="ci-module">
            <div className="ci-tt ci-alt">{t('catalogueIntelligence.value.mod2Title')}</div>
            <p>{t('catalogueIntelligence.value.mod2Body')}</p>
          </div>
          <div className="ci-module">
            <div className="ci-tt ci-alt">{t('catalogueIntelligence.value.mod3Title')}</div>
            <p><Trans i18nKey="catalogueIntelligence.value.mod3Body" components={{ a: <a className="rx-copylink" href={BLOG.discoveryRevenue} /> }} /></p>
          </div>
        </div>
      </div>

      <div className="ci-wrap ci-bleed ci-fig">
        <div className="ci-stagebox">
          <div className="ci-grain" aria-hidden="true" />

          {/* ================= CROSS-ERA · DESKTOP ================= */}
          <svg
            className="ci-d-only"
            viewBox="0 0 1200 330"
            role="img"
            aria-label={t('catalogueIntelligence.value.figureAriaD')}
          >
            <text x="60" y="40" fontSize="8" letterSpacing="2" fill="rgba(185,185,185,.6)">
              {t('catalogueIntelligence.figures.releaseContext')}
            </text>
            <line x1="60" y1="66" x2="820" y2="66" stroke="rgba(255,255,255,.1)" />
            <g stroke="rgba(255,255,255,.14)">
              <line x1="60" y1="60" x2="60" y2="72" />
              <line x1="250" y1="62" x2="250" y2="70" />
              <line x1="440" y1="62" x2="440" y2="70" />
              <line x1="630" y1="62" x2="630" y2="70" />
              <line x1="820" y1="60" x2="820" y2="72" />
            </g>
            <text x="60" y="88" fontSize="7" letterSpacing="1.2" fill="rgba(185,185,185,.4)">
              {t('catalogueIntelligence.figures.earlier')}
            </text>
            <text x="820" y="88" fontSize="7" letterSpacing="1.2" textAnchor="end" fill="rgba(185,185,185,.4)">
              {t('catalogueIntelligence.figures.recent')}
            </text>

            {/* records on the timeline */}
            <g className="ci-resolve d2">
              <rect x="118" y="118" width="26" height="15" fill="rgba(255,255,255,.6)" />
              <line x1="123" y1="125" x2="139" y2="125" stroke="#101010" />
              <text x="131" y="104" fontSize="7" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.6)">
                CAT-00417 · 2012
              </text>
              <text x="131" y="90" fontSize="7.5" letterSpacing="1.2" textAnchor="middle" fill="rgba(255,255,255,.7)">
                {t('catalogueIntelligence.figures.olderRecording')}
              </text>
            </g>
            <g fill="rgba(255,255,255,.28)">
              <rect x="330" y="118" width="26" height="15" />
              <rect x="470" y="118" width="26" height="15" />
              <rect x="600" y="118" width="26" height="15" />
            </g>
            <g fontSize="6.5" letterSpacing="1" fill="rgba(185,185,185,.35)" textAnchor="middle">
              <text x="343" y="148">CAT-01388</text>
              <text x="483" y="148">CAT-00902</text>
              <text x="613" y="148">REC-1C44</text>
            </g>
            <g>
              <circle cx="783" cy="125" r="20" fill={url('halo')} />
              <rect x="770" y="118" width="26" height="15" fill="#EE4A26" />
              <line x1="775" y1="125" x2="791" y2="125" stroke="#101010" />
              <text x="783" y="90" fontSize="7.5" letterSpacing="1.2" textAnchor="middle" fill="rgba(255,255,255,.85)">
                {t('catalogueIntelligence.figures.activeReference')}
              </text>
              <text x="783" y="104" fontSize="7" letterSpacing="1" textAnchor="middle" fill="rgba(185,185,185,.6)">
                CAT-01842 · 2026
              </text>
            </g>

            {/* sonic relationship layer */}
            <text x="60" y="196" fontSize="8" letterSpacing="2" fill="rgba(255,255,255,.7)">
              {t('catalogueIntelligence.figures.sonicRelationship')}
            </text>
            <path
              className="ci-sig"
              d="M 783 140 C 700 208, 400 212, 160 152 C 150 149, 140 144, 133 136"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.6"
            />

            {/* mini ranked list where the older recording appears */}
            <g>
              <rect x="900" y="120" width="240" height="150" fill="#151516" stroke="rgba(255,255,255,.14)" />
              <text x="916" y="144" fontSize="8.2" letterSpacing="1.4" fill="rgba(185,185,185,.7)">
                {t('catalogueIntelligence.figures.rankedResultsFor')}
              </text>
              <g fontSize="8" letterSpacing="1">
                <text x="916" y="170" fill="rgba(255,255,255,.6)">01</text>
                <text x="944" y="170" fill="rgba(255,255,255,.85)">CAT-02290</text>
                <text x="1124" y="170" textAnchor="end" fill="rgba(185,185,185,.55)">93.1%</text>
                <g className="ci-resolve d3">
                  <rect x="908" y="180" width="224" height="20" fill="rgba(238,74,38,.12)" />
                  <text x="916" y="194" fill="#EE4A26">02</text>
                  <text x="944" y="194" fill="rgba(255,255,255,.95)">CAT-00417 · 2012</text>
                  <text x="1124" y="194" textAnchor="end" fill="rgba(238,74,38,.9)">92.6%</text>
                </g>
                <text x="916" y="218" fill="rgba(255,255,255,.55)">03</text>
                <text x="944" y="218" fill="rgba(255,255,255,.8)">REC-1C44</text>
                <text x="1124" y="218" textAnchor="end" fill="rgba(185,185,185,.5)">91.9%</text>
                <text x="916" y="242" fill="rgba(255,255,255,.5)">04</text>
                <text x="944" y="242" fill="rgba(255,255,255,.75)">CAT-01388</text>
                <text x="1124" y="242" textAnchor="end" fill="rgba(185,185,185,.45)">91.3%</text>
              </g>
            </g>
            <path
              className="ci-sig"
              d="M 820 172 C 856 180, 872 186, 896 192"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.4"
            />

            <text x="600" y="308" fontSize="7.5" letterSpacing="1.4" textAnchor="middle" fill="rgba(185,185,185,.55)">
              {t('catalogueIntelligence.figures.recencyDoesNot')}
            </text>
          </svg>

          {/* ================= CROSS-ERA · MOBILE ================= */}
          <svg
            className="ci-m-only"
            viewBox="0 0 390 430"
            role="img"
            aria-label={t('catalogueIntelligence.value.figureAriaM')}
          >
            <text x="24" y="24" fontSize="7.5" letterSpacing="1.4" fill="rgba(185,185,185,.6)">
              {t('catalogueIntelligence.figures.releaseContext')}
            </text>
            <g>
              <circle cx="70" cy="66" r="18" fill={url('halo')} />
              <rect x="58" y="59" width="24" height="14" fill="#EE4A26" />
              <text x="94" y="64" fontSize="7.5" letterSpacing="1" fill="rgba(255,255,255,.85)">
                {t('catalogueIntelligence.figures.activeReference')}
              </text>
              <text x="94" y="78" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
                CAT-01842 · 2026
              </text>
            </g>
            <path
              className="ci-sig"
              d="M 70 84 C 70 130, 70 150, 70 178"
              fill="none"
              stroke="#EE4A26"
              strokeWidth="1.5"
            />
            <text x="24" y="150" fontSize="7.5" letterSpacing="1.4" fill="rgba(255,255,255,.7)">
              {t('catalogueIntelligence.figures.sonicRelationship')}
            </text>
            <g className="ci-resolve d2">
              <rect x="58" y="186" width="24" height="14" fill="rgba(255,255,255,.6)" />
              <text x="94" y="192" fontSize="7.5" letterSpacing="1" fill="rgba(255,255,255,.85)">
                {t('catalogueIntelligence.figures.olderRecording')}
              </text>
              <text x="94" y="206" fontSize="6.8" letterSpacing="1" fill="rgba(185,185,185,.55)">
                CAT-00417 · 2012
              </text>
            </g>
            <rect x="24" y="240" width="342" height="140" fill="#151516" stroke="rgba(255,255,255,.14)" />
            <text x="40" y="264" fontSize="7.8" letterSpacing="1.2" fill="rgba(185,185,185,.7)">
              {t('catalogueIntelligence.figures.rankedResultsFor')}
            </text>
            <g fontSize="7.6" letterSpacing="1">
              <text x="40" y="288" fill="rgba(255,255,255,.6)">01</text>
              <text x="68" y="288" fill="rgba(255,255,255,.85)">CAT-02290</text>
              <text x="350" y="288" textAnchor="end" fill="rgba(185,185,185,.55)">93.1%</text>
              <g className="ci-resolve d3">
                <rect x="32" y="296" width="326" height="20" fill="rgba(238,74,38,.12)" />
                <text x="40" y="310" fill="#EE4A26">02</text>
                <text x="68" y="310" fill="rgba(255,255,255,.95)">CAT-00417 · 2012</text>
                <text x="350" y="310" textAnchor="end" fill="rgba(238,74,38,.9)">92.6%</text>
              </g>
              <text x="40" y="334" fill="rgba(255,255,255,.55)">03</text>
              <text x="68" y="334" fill="rgba(255,255,255,.8)">REC-1C44</text>
              <text x="350" y="334" textAnchor="end" fill="rgba(185,185,185,.5)">91.9%</text>
              <text x="40" y="358" fill="rgba(255,255,255,.5)">04</text>
              <text x="68" y="358" fill="rgba(255,255,255,.75)">CAT-01388</text>
              <text x="350" y="358" textAnchor="end" fill="rgba(185,185,185,.45)">91.3%</text>
            </g>
            <text x="24" y="412" fontSize="6.6" letterSpacing=".9" fill="rgba(185,185,185,.55)">
              {t('catalogueIntelligence.figures.recencyDoesNot')}
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
