import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

function RediscoverArt({
  bside,
  recent,
}: {
  bside: string;
  recent: string;
}) {
  return (
    <svg className="dj-sl" viewBox="0 0 300 110" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.25)' }}>
        <path d="M40 84 V44 M52 84 V52 M64 84 V40 M76 84 V56" />
      </g>
      <path d="M88 84 V38" style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.8 }} />
      <g style={{ color: 'rgba(255,255,255,.5)' }}>
        <path d="M228 84 V46 M240 84 V38 M252 84 V54" />
      </g>
      <path
        className="dj-dashflow"
        d="M88 38 C 140 14 190 16 240 38"
        style={{ color: 'rgba(238,74,38,.55)', strokeWidth: 1.4 }}
      />
      <text
        x="60"
        y="102"
        textAnchor="middle"
        style={{ fontSize: '10px', fill: '#EE4A26' }}
      >
        {bside}
      </text>
      <text x="240" y="102" textAnchor="middle" style={{ fontSize: '10px' }}>
        {recent}
      </text>
    </svg>
  );
}

function ConnectionsArt({
  genreA,
  genreB,
  genreC,
}: {
  genreA: string;
  genreB: string;
  genreC: string;
}) {
  return (
    <svg className="dj-sl" viewBox="0 0 300 110" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.18)' }}>
        <line x1="106" y1="20" x2="106" y2="92" strokeDasharray="3 5" />
        <line x1="196" y1="20" x2="196" y2="92" strokeDasharray="3 5" />
      </g>
      <g style={{ fill: '#6a6a6a' }}>
        <text x="56" y="34" textAnchor="middle" style={{ fontSize: '9px' }}>
          {genreA}
        </text>
        <text x="151" y="34" textAnchor="middle" style={{ fontSize: '9px' }}>
          {genreB}
        </text>
        <text x="246" y="34" textAnchor="middle" style={{ fontSize: '9px' }}>
          {genreC}
        </text>
      </g>
      <g style={{ color: 'rgba(255,255,255,.32)' }}>
        <circle cx="56" cy="66" r="2.4" />
        <circle cx="72" cy="78" r="2.4" />
        <circle cx="140" cy="60" r="2.4" />
        <circle cx="160" cy="74" r="2.4" />
        <circle cx="236" cy="64" r="2.4" />
        <circle cx="254" cy="78" r="2.4" />
      </g>
      <path
        className="dj-dashflow"
        d="M56 66 C 110 44 200 46 254 64"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.5 }}
      />
      <circle cx="56" cy="66" r="6" style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.5 }} />
      <circle cx="254" cy="78" r="6" style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.5 }} />
    </svg>
  );
}

function EscapeArt({ sameDozen, newDirection }: { sameDozen: string; newDirection: string }) {
  return (
    <svg className="dj-sl" viewBox="0 0 300 110" aria-hidden="true">
      <path
        d="M96 56 a34 34 0 1 1 24 32"
        style={{ color: 'rgba(255,255,255,.3)', strokeWidth: 1.4 }}
      />
      <g style={{ color: 'rgba(255,255,255,.35)' }}>
        <circle cx="130" cy="24" r="2.4" />
        <circle cx="96" cy="56" r="2.4" />
        <circle cx="118" cy="86" r="2.4" />
      </g>
      <path
        className="dj-dashflow"
        d="M120 88 C 170 100 220 84 258 56"
        style={{ color: 'rgba(238,74,38,.65)', strokeWidth: 1.8 }}
      />
      <circle cx="262" cy="52" r="4" style={{ fill: '#EE4A26', stroke: 'none' }} />
      <text x="106" y="18" style={{ fontSize: '10px' }}>
        {sameDozen}
      </text>
      <text
        x="292"
        y="34"
        textAnchor="end"
        style={{ fontSize: '10px', fill: '#d8d8d8' }}
      >
        {newDirection}
      </text>
    </svg>
  );
}

function PrepareArt({ folders, journey }: { folders: string; journey: string }) {
  return (
    <svg className="dj-sl" viewBox="0 0 300 110" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.28)' }}>
        <rect x="24" y="28" width="34" height="24" />
        <rect x="24" y="60" width="34" height="24" />
        <rect x="66" y="28" width="34" height="24" />
        <rect x="66" y="60" width="34" height="24" />
      </g>
      <path
        className="dj-dashflow"
        d="M108 56 H150"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.4 }}
      />
      <g style={{ color: 'rgba(238,74,38,.75)' }}>
        <path d="M154 70 C 190 44 230 76 270 50" style={{ strokeWidth: 1.8 }} />
      </g>
      <g style={{ color: 'rgba(238,74,38,.85)' }}>
        <circle cx="196" cy="56" r="5" style={{ strokeWidth: 1.4 }} />
        <circle cx="244" cy="66" r="5" style={{ strokeWidth: 1.4 }} />
      </g>
      <text x="42" y="102" textAnchor="middle" style={{ fontSize: '10px' }}>
        {folders}
      </text>
      <text
        x="212"
        y="102"
        textAnchor="middle"
        style={{ fontSize: '10px', fill: '#d8d8d8' }}
      >
        {journey}
      </text>
    </svg>
  );
}

export function DjJourneys() {
  const { t } = useTranslation('common');

  const cards = [
    {
      key: 'rediscover',
      art: (
        <RediscoverArt
          bside={t('djs.figures.bsideYearsAgo')}
          recent={t('djs.figures.recentRelease')}
        />
      ),
    },
    {
      key: 'connections',
      art: (
        <ConnectionsArt
          genreA={t('djs.figures.genreA')}
          genreB={t('djs.figures.genreB')}
          genreC={t('djs.figures.genreC')}
        />
      ),
    },
    {
      key: 'escape',
      art: (
        <EscapeArt
          sameDozen={t('djs.figures.sameDozen')}
          newDirection={t('djs.figures.newDirection')}
        />
      ),
    },
    {
      key: 'prepare',
      art: (
        <PrepareArt
          folders={t('djs.figures.folders')}
          journey={t('djs.figures.journeyOfSet')}
        />
      ),
    },
  ] as const;

  return (
    <section className="dj-section" id="dj-journeys">
      <div className="dj-frame">
        <p className="dj-eyebrow uppercase">{t('djs.journeys.eyebrow')}</p>
        <h2 className="dj-h2b uppercase">{t('djs.journeys.h2')}</h2>
        <div className="dj-wf-lead">
          <p className="dj-body">{t('djs.journeys.lead1')}</p>
          <p className="dj-body">{t('djs.journeys.lead2')}</p>
          <p className="dj-body"><Trans i18nKey="djs.journeys.lead3" components={{ a: <a href={BLOG.techno} /> }} /></p>
          <p className="dj-body dj-body-soft" style={{ marginBottom: 0 }}>
            {t('djs.journeys.intro')}
          </p>
        </div>

        <div className="dj-wfs">
          {cards.map((card) => (
            <article key={card.key} className="dj-wf">
              <div className="dj-wf-art" aria-hidden="true">
                {card.art}
              </div>
              <span className="dj-wf-k uppercase">
                {t(`djs.journeys.items.${card.key}.label`)}
              </span>
              <p className="dj-wf-txt">{t(`djs.journeys.items.${card.key}.text`)}</p>
            </article>
          ))}
        </div>

        <p className="dj-pull dj-wf-close">{t('djs.journeys.pull')}</p>
      </div>
    </section>
  );
}
