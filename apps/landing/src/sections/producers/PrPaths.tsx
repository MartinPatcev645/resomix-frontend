import { useTranslation } from 'react-i18next';

function StrongerArt({ label }: { label: string }) {
  return (
    <svg className="pr-sl" viewBox="0 0 300 110" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.18)' }}>
        <line x1="150" y1="18" x2="150" y2="92" strokeDasharray="3 5" />
      </g>
      <g style={{ color: 'rgba(255,255,255,.32)' }}>
        <circle cx="60" cy="60" r="2.4" />
        <circle cx="90" cy="44" r="2.4" />
        <circle cx="110" cy="72" r="2.4" />
        <circle cx="200" cy="40" r="2.4" />
        <circle cx="228" cy="62" r="2.4" />
        <circle cx="248" cy="46" r="2.4" />
      </g>
      <path
        className="pr-dashflow"
        d="M90 44 C 140 20 190 22 228 58"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.5 }}
      />
      <circle cx="90" cy="44" r="6" style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.5 }} />
      <circle cx="228" cy="62" r="6" style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.5 }} />
      <text x="150" y="104" textAnchor="middle" style={{ fontSize: '10px' }}>
        {label}
      </text>
    </svg>
  );
}

function PatternsArt({ habit, fresh }: { habit: string; fresh: string }) {
  return (
    <svg className="pr-sl" viewBox="0 0 300 110" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.25)' }}>
        <path d="M30 56 l8-10 7 16 8-20 7 14" />
        <path d="M90 56 l8-10 7 16 8-20 7 14" />
        <path d="M150 56 l8-10 7 16 8-20 7 14" />
      </g>
      <g style={{ color: 'rgba(238,74,38,.75)' }}>
        <path
          d="M212 62 C 224 34 244 30 258 44 C 270 56 268 74 254 82"
          style={{ strokeWidth: 1.6 }}
        />
      </g>
      <text x="106" y="98" textAnchor="middle" style={{ fontSize: '10px' }}>
        {habit}
      </text>
      <text
        x="240"
        y="104"
        textAnchor="middle"
        style={{ fontSize: '10px', fill: '#d8d8d8' }}
      >
        {fresh}
      </text>
    </svg>
  );
}

function ConnectionsArt({ label }: { label: string }) {
  return (
    <svg className="pr-sl" viewBox="0 0 300 110" aria-hidden="true">
      <circle cx="56" cy="56" r="3.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
      <path
        className="pr-dashflow"
        d="M56 56 C 110 30 170 30 224 52"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.5 }}
      />
      <circle cx="228" cy="54" r="6" style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.5 }} />
      <g>
        <circle cx="196" cy="88" r="2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
        <circle cx="222" cy="94" r="2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
        <circle cx="248" cy="88" r="2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
        <circle cx="270" cy="78" r="2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
      </g>
      <text x="70" y="98" style={{ fontSize: '10px' }}>
        {label}
      </text>
    </svg>
  );
}

function ReinterpretArt({ label }: { label: string }) {
  return (
    <svg className="pr-sl" viewBox="0 0 300 110" aria-hidden="true">
      <circle cx="48" cy="56" r="4" style={{ fill: '#EE4A26', stroke: 'none' }} />
      <g style={{ color: 'rgba(238,74,38,.5)' }}>
        <path d="M56 52 C 100 34 140 30 180 38" />
        <path d="M56 60 C 100 78 140 84 180 78" />
      </g>
      <g style={{ color: 'rgba(255,255,255,.75)' }}>
        <path
          d="M188 58 C 214 44 234 66 254 52 C 266 44 276 44 284 48"
          style={{ strokeWidth: 1.6 }}
        />
      </g>
      <text x="150" y="102" textAnchor="middle" style={{ fontSize: '10px' }}>
        {label}
      </text>
    </svg>
  );
}

export function PrPaths() {
  const { t } = useTranslation('common');

  const cards = [
    {
      key: 'stronger',
      art: <StrongerArt label={t('producers.figures.newSonicTerritories')} />,
    },
    {
      key: 'patterns',
      art: (
        <PatternsArt
          habit={t('producers.figures.theHabit')}
          fresh={t('producers.figures.freshInput')}
        />
      ),
    },
    {
      key: 'connections',
      art: <ConnectionsArt label={t('producers.figures.outsideUsualScene')} />,
    },
    {
      key: 'reinterpret',
      art: <ReinterpretArt label={t('producers.figures.yourCreativeLanguage')} />,
    },
  ] as const;

  return (
    <section className="pr-section" id="pr-paths">
      <div className="pr-frame">
        <p className="pr-eyebrow uppercase">{t('producers.paths.eyebrow')}</p>
        <h2 className="pr-h2b uppercase">{t('producers.paths.h2')}</h2>
        <div className="pr-wf-lead">
          <p className="pr-body">{t('producers.paths.intro')}</p>
          <p className="pr-body">{t('producers.paths.engine')}</p>
          <p className="pr-body">{t('producers.paths.connections')}</p>
          <p className="pr-body pr-body-soft">{t('producers.paths.listIntro')}</p>
        </div>
        <div className="pr-wfs">
          {cards.map((card) => (
            <article key={card.key} className="pr-wf">
              <div className="pr-wf-art" aria-hidden="true">
                {card.art}
              </div>
              <span className="pr-wf-k">
                {t(`producers.paths.items.${card.key}.label`)}
              </span>
              <p className="pr-wf-txt">
                {t(`producers.paths.items.${card.key}.text`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
