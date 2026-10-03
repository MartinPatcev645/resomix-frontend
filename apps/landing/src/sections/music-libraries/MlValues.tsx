import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

const VALUE_KEYS = [
  'findFaster',
  'discoverability',
  'connections',
  'experience',
  'value',
] as const;

function TraceFindFaster() {
  return (
    <svg className="ml-sl" viewBox="0 0 160 36" aria-hidden="true">
      <path
        d="M6 18 l6-6 5 10 6-14 6 16 5-11 4 6"
        style={{ color: 'rgba(255,255,255,.5)' }}
      />
      <path
        className="ml-dashflow"
        d="M44 18 H96"
        style={{ color: 'rgba(238,74,38,.6)' }}
      />
      <g style={{ color: 'rgba(255,255,255,.6)' }}>
        <rect x="102" y="10" width="50" height="16" />
      </g>
    </svg>
  );
}

function TraceDiscoverability() {
  return (
    <svg className="ml-sl" viewBox="0 0 160 36" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.3)' }}>
        <rect x="8" y="10" width="16" height="16" />
        <rect x="32" y="10" width="16" height="16" />
        <rect x="80" y="10" width="16" height="16" />
        <rect x="104" y="10" width="16" height="16" />
      </g>
      <rect
        x="56"
        y="10"
        width="16"
        height="16"
        style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.4 }}
      />
      <circle
        className="ml-glowp"
        cx="64"
        cy="18"
        r="2.5"
        style={{ fill: '#EE4A26', stroke: 'none' }}
      />
    </svg>
  );
}

function TraceConnections() {
  return (
    <svg className="ml-sl" viewBox="0 0 160 36" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.32)' }}>
        <circle cx="24" cy="26" r="2.2" />
        <circle cx="38" cy="18" r="2.2" />
        <circle cx="120" cy="12" r="2.2" />
        <circle cx="136" cy="22" r="2.2" />
      </g>
      <path
        className="ml-dashflow"
        d="M38 18 C 70 4 100 4 120 12"
        style={{ color: 'rgba(238,74,38,.6)' }}
      />
    </svg>
  );
}

function TraceExperience() {
  return (
    <svg className="ml-sl" viewBox="0 0 160 36" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.25)' }}>
        <rect x="10" y="8" width="140" height="20" rx="10" />
      </g>
      <path
        d="M22 18 C 50 12 80 24 110 16 C 124 13 134 14 140 16"
        style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.5 }}
      />
    </svg>
  );
}

function TraceValue() {
  return (
    <svg className="ml-sl" viewBox="0 0 160 36" aria-hidden="true">
      <g style={{ color: 'rgba(255,255,255,.3)' }}>
        <rect x="12" y="12" width="12" height="12" />
        <rect x="30" y="12" width="12" height="12" />
        <rect x="48" y="12" width="12" height="12" />
        <rect x="66" y="12" width="12" height="12" />
      </g>
      <g style={{ color: 'rgba(238,74,38,.7)' }}>
        <rect x="96" y="12" width="12" height="12" style={{ strokeWidth: 1.4 }} />
        <rect x="114" y="12" width="12" height="12" style={{ strokeWidth: 1.4 }} />
        <rect x="132" y="12" width="12" height="12" style={{ strokeWidth: 1.4 }} />
      </g>
    </svg>
  );
}

const TRACES = {
  findFaster: TraceFindFaster,
  discoverability: TraceDiscoverability,
  connections: TraceConnections,
  experience: TraceExperience,
  value: TraceValue,
} as const;

export function MlValues() {
  const { t } = useTranslation('common');

  return (
    <section className="ml-section" id="ml-values">
      <div className="ml-frame">
        <p className="ml-eyebrow uppercase">{t('musicLibraries.values.eyebrow')}</p>
        <h2 className="ml-h2b uppercase">{t('musicLibraries.values.h2')}</h2>
        <p className="ml-body">{t('musicLibraries.values.lead1')}</p>
        <p className="ml-body">{t('musicLibraries.values.lead2')}</p>
        <p className="ml-body"><Trans i18nKey="musicLibraries.values.lead3" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.supervisors} /> }} /></p>
        <p className="ml-body ml-body-soft" style={{ marginBottom: 0 }}>
          {t('musicLibraries.values.couldMean')}
        </p>

        <div className="ml-vals">
          {VALUE_KEYS.map((key) => {
            const Trace = TRACES[key];
            return (
              <div key={key} className="ml-val">
                <div className="ml-val-tr" aria-hidden="true">
                  <Trace />
                </div>
                <span className="ml-val-k">
                  {t(`musicLibraries.values.items.${key}.label`)}
                </span>
                <span className="ml-val-o">
                  {t(`musicLibraries.values.items.${key}.text`)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="ml-pull ml-val-close">{t('musicLibraries.values.pull')}</p>
      </div>
    </section>
  );
}
