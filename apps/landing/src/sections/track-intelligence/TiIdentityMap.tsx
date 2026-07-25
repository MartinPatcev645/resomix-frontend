import { useTranslation } from 'react-i18next';

type SigRow = {
  label: string;
  value: string;
  width: string;
  variant: 'strong' | 'support' | 'weak' | 'uncertain';
};

const GENRE_ROWS: SigRow[] = [
  { label: 'deep house', value: '0.62', width: '62%', variant: 'strong' },
  { label: 'tech house', value: '0.21', width: '21%', variant: 'support' },
  { label: 'minimal', value: '0.09', width: '9%', variant: 'weak' },
  { label: 'dub techno', value: '0.05', width: '5%', variant: 'uncertain' },
];

const MOOD_ROWS: SigRow[] = [
  { label: 'dark', value: 'strong', width: '78%', variant: 'strong' },
  { label: 'hypnotic', value: 'strong', width: '71%', variant: 'strong' },
  { label: 'late-night', value: 'supporting', width: '54%', variant: 'support' },
  { label: 'euphoric', value: 'uncertain', width: '18%', variant: 'uncertain' },
];

function SigBar({ row }: { row: SigRow }) {
  const cls =
    row.variant === 'strong'
      ? 'ti-sigrow ti-sig-strong'
      : row.variant === 'support'
        ? 'ti-sigrow ti-sig-support'
        : 'ti-sigrow';
  const barCls = row.variant === 'uncertain' || row.variant === 'weak' ? 'ti-sigbar ti-sig-weak' : 'ti-sigbar';
  return (
    <div className={cls}>
      <span className="ti-lbl uppercase">
        <span>{row.label}</span>
        <span>{row.value}</span>
      </span>
      <div className={barCls}>
        <i style={{ width: row.width }} />
      </div>
    </div>
  );
}

export function TiIdentityMap() {
  const { t } = useTranslation('common');
  const vibeChips = ['chip1', 'chip2', 'chip3', 'chip4', 'chip5'] as const;

  return (
    <section id="ti-identity" className="ti-section" aria-label="Style, mood and sonic identity">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.identity.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.identity.title')}</h2>
        <p className="ti-lead">{t('trackIntelligence.identity.lead')}</p>
      </header>

      <div className="ti-idmap">
        <div className="ti-idcol">
          <h3 className="ti-h3b uppercase">{t('trackIntelligence.identity.genreTitle')}</h3>
          {GENRE_ROWS.map((row) => (
            <SigBar key={row.label} row={row} />
          ))}
          <p className="ti-lbl-dim mt-[var(--px-16)]">{t('trackIntelligence.identity.genreDetail')}</p>
        </div>
        <div className="ti-idcol">
          <h3 className="ti-h3b uppercase">{t('trackIntelligence.identity.moodTitle')}</h3>
          {MOOD_ROWS.map((row) => (
            <SigBar key={row.label} row={row} />
          ))}
        </div>
        <div className="ti-idcol">
          <h3 className="ti-h3b uppercase">{t('trackIntelligence.identity.vibeTitle')}</h3>
          <div className="ti-idchips">
            {vibeChips.map((key) => (
              <span key={key} className="ti-chip">
                {t(`trackIntelligence.identity.vibe.${key}`)}
              </span>
            ))}
          </div>
          <p className="ti-body mt-[var(--px-20)] text-[length:var(--px-15)]">
            {t('trackIntelligence.identity.vibeBody')}
          </p>
        </div>
      </div>

      <div
        className="ti-env-legend"
        role="img"
        aria-label={t('trackIntelligence.identity.legendAlt')}
      >
        <span>
          <i className="ti-e1" />{t('trackIntelligence.identity.legendStrong')}
        </span>
        <span>
          <i className="ti-e2" />{t('trackIntelligence.identity.legendSupport')}
        </span>
        <span>
          <i className="ti-e3" />{t('trackIntelligence.identity.legendUncertain')}
        </span>
        <span className="ti-truth ml-auto uppercase">{t('trackIntelligence.identity.sampleData')}</span>
      </div>

      <p className="ti-interp mt-[var(--px-24)]">{t('trackIntelligence.identity.overlapInterp')}</p>
    </section>
  );
}
