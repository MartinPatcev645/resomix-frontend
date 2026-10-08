import Link from 'next/link'
import { t } from '@/lib/i18n'

/* illustrative / fictional sample response */
const SAMPLE_RESPONSE = `{ "rank": 1,
  "score": 0.981,
  "title": "…" }`;

const JoinArrow = () => (
  <div className="hm-join" aria-hidden="true">
    <svg className="hm-join-h" viewBox="0 0 44 32">
      <g
        style={{
          stroke: 'currentColor',
          fill: 'none',
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      >
        <path d="M2 16 H38" vectorEffect="non-scaling-stroke" />
        <path d="M34 11 L40 16 L34 21" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
    <svg className="hm-join-v" viewBox="0 0 32 44">
      <g
        style={{
          stroke: 'currentColor',
          fill: 'none',
          strokeWidth: 1.25,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      >
        <path d="M16 2 V38" vectorEffect="non-scaling-stroke" />
        <path d="M11 34 L16 40 L21 34" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  </div>
);

export function HmApi() {
  return (
    <section className="hm-section" id="hm-api">
      <div className="hm-frame">
        <p className="hm-eyebrow uppercase">{t('home.api.eyebrow')}</p>
        <h2 className="hm-h2b uppercase">{t('home.api.head')}</h2>
        <div className="hm-api-flow" role="img" aria-label={t('home.api.figureAria')}>
          <div className="hm-astage">
            <span className="hm-anum">01</span>
            <span className="hm-at">{t('home.api.s01t')}</span>
            <div className="hm-arows" aria-hidden="true"><i /><i /><i /></div>
            <span className="hm-ad">{t('home.api.s01d')}</span>
          </div>
          <JoinArrow />
          <div className="hm-astage hm-aiso">
            <span className="hm-anum">02</span>
            <span className="hm-at">{t('home.api.s02t')}</span>
            <span className="hm-aiso-tag">{t('home.api.s02tag')}</span>
            <div className="hm-lanes" aria-hidden="true">
              <span>{t('home.api.laneSearch')}</span>
              <span>{t('home.api.laneSimilarity')}</span>
              <span>{t('home.api.laneAnalysis')}</span>
            </div>
            <span className="hm-ad">{t('home.api.s02d')}</span>
          </div>
          <JoinArrow />
          <div className="hm-astage">
            <span className="hm-anum">03</span>
            <span className="hm-at">{t('home.api.s03t')}</span>
            <code className="hm-acode" aria-hidden="true">{SAMPLE_RESPONSE}</code>
          </div>
          <JoinArrow />
          <div className="hm-astage">
            <span className="hm-anum">04</span>
            <span className="hm-at">{t('home.api.s04t')}</span>
            <div className="hm-arows" aria-hidden="true"><i /><i /><i /></div>
            <span className="hm-ad">{t('home.api.s04d')}</span>
          </div>
        </div>
        <div className="hm-dev-row">
          <span className="hm-truth">{t('home.api.truth')}</span>
          <Link className="hm-cta-s" href="/developers">
            {t('home.api.exploreCta')}
          </Link>
        </div>
      </div>
    </section>
  );
}
