import { Trans, useTranslation } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

/** Blog destination per workflow card, from the interlinking map. Only MB-17 is mapped. */
const WORKFLOW_BLOG: Record<string, string | undefined> = { dormant: BLOG.backCatalogue };

function DemoFieldArt() {
  return (
    <svg className="rl-sl" viewBox="0 0 300 120" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.55)' }}>
        <path d="M16 60 l8-8 6 13 8-18 8 22 7-15 6 7" />
      </g>
      <circle className="rl-pulse" cx="66" cy="60" r="3.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
      <g style={{ color: 'rgba(255,255,255,.3)' }}>
        <circle cx="170" cy="40" r="2.4" />
        <circle cx="192" cy="56" r="2.4" />
        <circle cx="176" cy="76" r="2.4" />
        <circle cx="214" cy="44" r="2.4" />
        <circle cx="230" cy="70" r="2.4" />
        <circle cx="206" cy="90" r="2.4" />
        <circle cx="252" cy="58" r="2.4" />
      </g>
      <path
        className="rl-dashflow"
        d="M66 60 C 110 60 130 58 176 58"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.4 }}
      />
      <circle cx="192" cy="56" r="7" style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.6 }} />
    </svg>
  );
}

function DormantArt({ label }: { label: string }) {
  return (
    <svg className="rl-sl" viewBox="0 0 300 120" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.28)' }}>
        <line x1="30" y1="96" x2="30" y2="64" />
        <line x1="54" y1="96" x2="54" y2="76" />
        <line x1="78" y1="96" x2="78" y2="56" />
        <line x1="102" y1="96" x2="102" y2="80" />
        <line x1="126" y1="96" x2="126" y2="68" />
        <line x1="150" y1="96" x2="150" y2="84" />
        <line x1="198" y1="96" x2="198" y2="72" />
        <line x1="222" y1="96" x2="222" y2="60" />
        <line x1="246" y1="96" x2="246" y2="82" />
        <line x1="270" y1="96" x2="270" y2="66" />
      </g>
      <line x1="174" y1="96" x2="174" y2="52" style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.8 }} />
      <circle className="rl-glowp" cx="174" cy="46" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
      <circle cx="174" cy="46" r="10" style={{ color: 'rgba(238,74,38,.35)' }} />
      <text x="140" y="28" fontSize="10" style={{ fill: '#EE4A26' }}>
        {label}
      </text>
    </svg>
  );
}

function BriefArt({ label }: { label: string }) {
  return (
    <svg className="rl-sl" viewBox="0 0 300 120" aria-hidden="true">
      <rect x="16" y="40" width="74" height="40" style={{ color: 'rgba(255,255,255,.4)' }} />
      <g style={{ color: 'rgba(255,255,255,.35)' }}>
        <path d="M28 54 H78 M28 64 H64" />
      </g>
      <text x="16" y="102" fontSize="10">
        {label}
      </text>
      <path
        className="rl-dashflow"
        d="M90 60 H140"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.4 }}
      />
      <g style={{ color: 'rgba(255,255,255,.65)' }}>
        <rect x="144" y="26" width="140" height="22" />
      </g>
      <g style={{ color: 'rgba(255,255,255,.3)' }}>
        <rect x="144" y="56" width="118" height="22" />
        <rect x="144" y="86" width="96" height="22" />
      </g>
      <g style={{ fill: 'rgba(255,255,255,.35)' }}>
        <circle cx="156" cy="37" r="2" />
        <circle cx="156" cy="67" r="2" />
        <circle cx="156" cy="97" r="2" />
      </g>
    </svg>
  );
}

function ClusterArt({ label }: { label: string }) {
  return (
    <svg className="rl-sl" viewBox="0 0 300 120" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.32)' }}>
        <circle cx="52" cy="44" r="2.6" />
        <circle cx="76" cy="32" r="2.6" />
        <circle cx="88" cy="56" r="2.6" />
        <circle cx="62" cy="70" r="2.6" />
        <circle cx="100" cy="80" r="2.6" />
      </g>
      <g style={{ color: 'rgba(255,255,255,.12)' }}>
        <path d="M76 32 L88 56 M52 44 L62 70 M88 56 L100 80" />
      </g>
      <path
        className="rl-dashflow"
        d="M112 58 H160"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.4 }}
      />
      <g style={{ color: 'rgba(255,255,255,.5)' }}>
        <rect x="168" y="24" width="112" height="16" />
        <rect x="168" y="48" width="112" height="16" />
        <rect x="168" y="72" width="112" height="16" />
      </g>
      <g fontSize="9" style={{ fill: '#9c9c9c' }}>
        <text x="176" y="36">
          01
        </text>
        <text x="176" y="60">
          02
        </text>
        <text x="176" y="84">
          03
        </text>
      </g>
      <text x="168" y="108" fontSize="10">
        {label}
      </text>
    </svg>
  );
}

export function RlWorkflows() {
  const { t } = useTranslation('common');

  const cards = [
    { key: 'demo', art: <DemoFieldArt /> },
    { key: 'dormant', art: <DormantArt label={t('recordLabels.figures.rediscovered')} /> },
    { key: 'brief', art: <BriefArt label={t('recordLabels.figures.briefIn')} /> },
    { key: 'cluster', art: <ClusterArt label={t('recordLabels.figures.cohesiveSound')} /> },
  ] as const;

  return (
    <section className="rl-section" id="rl-workflows">
      <div className="rl-frame">
        <p className="rl-eyebrow uppercase">{t('recordLabels.workflows.eyebrow')}</p>
        <h2 className="rl-h2b uppercase">{t('recordLabels.workflows.h2')}</h2>
        <div className="rl-wf-lead">
          <p className="rl-body">{t('recordLabels.workflows.lead1')}</p>
          <p className="rl-body" style={{ marginBottom: 0 }}>
            {t('recordLabels.workflows.lead2')}
          </p>
        </div>

        <div className="rl-wfs">
          {cards.map((card) => (
            <article key={card.key} className="rl-wf">
              <div className="rl-wf-art" aria-hidden="true">
                {card.art}
              </div>
              <p className="rl-wf-txt">
                {/* MB-17 sits on the dormant-catalogue card. */}
                <Trans
                  i18nKey={`recordLabels.workflows.items.${card.key}`}
                  components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={WORKFLOW_BLOG[card.key] ?? ''} /> }}
                />
              </p>
            </article>
          ))}
        </div>

        <p className="rl-body rl-wf-close" style={{ maxWidth: '44rem' }}>
          {t('recordLabels.workflows.close')}
        </p>
      </div>
    </section>
  );
}
