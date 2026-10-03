import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

function BriefArt({ briefIn, varied }: { briefIn: string; varied: string }) {
  return (
    <svg className="sa-sl" viewBox="0 0 300 120" aria-hidden="true">
      <rect x="16" y="40" width="74" height="40" style={{ color: 'rgba(255,255,255,.4)' }} />
      <g style={{ color: 'rgba(255,255,255,.35)' }}>
        <path d="M28 54 H78 M28 64 H64" />
      </g>
      <text x="16" y="102" style={{ fontSize: '10px' }}>
        {briefIn}
      </text>
      <path
        className="sa-dashflow"
        d="M90 60 H136"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.4 }}
      />
      <g style={{ color: 'rgba(255,255,255,.6)' }}>
        <rect x="140" y="24" width="140" height="20" />
      </g>
      <g style={{ color: 'rgba(255,255,255,.35)' }}>
        <rect x="140" y="52" width="118" height="20" />
        <rect x="140" y="80" width="96" height="20" />
      </g>
      <g>
        <circle cx="152" cy="34" r="2" style={{ fill: 'rgba(238,74,38,.6)', stroke: 'none' }} />
        <circle cx="152" cy="62" r="2" style={{ fill: 'rgba(238,74,38,.6)', stroke: 'none' }} />
        <circle cx="152" cy="90" r="2" style={{ fill: 'rgba(238,74,38,.6)', stroke: 'none' }} />
      </g>
      <text x="240" y="112" style={{ fontSize: '9.5px' }}>
        {varied}
      </text>
    </svg>
  );
}

function SecondChanceArt({ label }: { label: string }) {
  return (
    <svg className="sa-sl" viewBox="0 0 300 120" aria-hidden="true">
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
      <circle className="sa-glowp" cx="174" cy="46" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
      <circle cx="174" cy="46" r="10" style={{ color: 'rgba(238,74,38,.35)' }} />
      <text x="126" y="28" style={{ fontSize: '10px', fill: '#EE4A26' }}>
        {label}
      </text>
    </svg>
  );
}

function FoundBySoundArt({ tagAmbient, foundBySound }: { tagAmbient: string; foundBySound: string }) {
  return (
    <svg className="sa-sl" viewBox="0 0 300 120" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.25)' }}>
        <rect x="20" y="26" width="86" height="20" />
      </g>
      <text x="63" y="40" textAnchor="middle" style={{ fontSize: '8px' }}>
        {tagAmbient}
      </text>
      <g style={{ color: 'rgba(255,255,255,.55)' }}>
        <path d="M20 88 l9-10 7 15 9-20 8 24 8-16 8 9 9-5 8 6 9-12 8 9 9-5 8 4 9-8 8 9 9-4 8 5" />
      </g>
      <circle cx="176" cy="88" r="12" style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.6 }} />
      <text x="200" y="116" style={{ fontSize: '9.5px', fill: '#d8d8d8' }}>
        {foundBySound}
      </text>
    </svg>
  );
}

function ConnectionArt({ label }: { label: string }) {
  return (
    <svg className="sa-sl" viewBox="0 0 300 120" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.32)' }}>
        <circle cx="48" cy="88" r="2.4" />
        <circle cx="68" cy="72" r="2.4" />
        <circle cx="84" cy="94" r="2.4" />
        <circle cx="60" cy="104" r="2.4" />
        <circle cx="236" cy="40" r="2.4" />
        <circle cx="256" cy="52" r="2.4" />
        <circle cx="244" cy="66" r="2.4" />
        <circle cx="268" cy="34" r="2.4" />
      </g>
      <path
        className="sa-dashflow"
        d="M68 72 C 130 30 190 26 244 40"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.5 }}
      />
      <circle cx="68" cy="72" r="6.5" style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.5 }} />
      <circle cx="244" cy="40" r="6.5" style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.5 }} />
      <text x="96" y="110" style={{ fontSize: '9.5px' }}>
        {label}
      </text>
    </svg>
  );
}

export function SaWorkflows() {
  const { t } = useTranslation('common');

  const cards = [
    {
      key: 'brief',
      art: (
        <BriefArt
          briefIn={t('syncAgencies.figures.briefIn')}
          varied={t('syncAgencies.figures.varied')}
        />
      ),
    },
    {
      key: 'secondChance',
      art: <SecondChanceArt label={t('syncAgencies.figures.secondChance')} />,
    },
    {
      key: 'foundBySound',
      art: (
        <FoundBySoundArt
          tagAmbient={t('syncAgencies.figures.tagAmbientChip')}
          foundBySound={t('syncAgencies.figures.foundBySound')}
        />
      ),
    },
    {
      key: 'connection',
      art: <ConnectionArt label={t('syncAgencies.figures.unexpectedConnection')} />,
    },
  ] as const;

  return (
    <section className="sa-section" id="sa-workflows">
      <div className="sa-frame">
        <p className="sa-eyebrow uppercase">{t('syncAgencies.workflows.eyebrow')}</p>
        <h2 className="sa-h2b uppercase">{t('syncAgencies.workflows.h2')}</h2>
        <div className="sa-wf-lead">
          <p className="sa-body"><Trans i18nKey="syncAgencies.workflows.lead1" components={{ a: <a href={BLOG.beyondTags} /> }} /></p>
          <p className="sa-body" style={{ marginBottom: 0 }}>
            {t('syncAgencies.workflows.lead2')}
          </p>
        </div>

        <div className="sa-wfs">
          {cards.map((card) => (
            <article key={card.key} className="sa-wf">
              <div className="sa-wf-art" aria-hidden="true">
                {card.art}
              </div>
              <p className="sa-wf-txt">{t(`syncAgencies.workflows.items.${card.key}`)}</p>
            </article>
          ))}
        </div>

        <p className="sa-body sa-wf-close" style={{ maxWidth: '44rem' }}>
          {t('syncAgencies.workflows.close')}
        </p>
      </div>
    </section>
  );
}
