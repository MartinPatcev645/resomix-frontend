import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

const RAIL_KEYS = ['continuity', 'connections', 'taste', 'forgotten', 'directions'] as const;

/** Blog destination per rail item, from the interlinking map. Only MB-27 is mapped. */
const RAIL_BLOG: Partial<Record<(typeof RAIL_KEYS)[number], string>> = { directions: BLOG.ambient };

export function McuRail() {
  const { t } = useTranslation('common');

  return (
    <section className="mcu-section" id="mcu-rail">
      <div className="mcu-frame">
        <p className="mcu-eyebrow uppercase">{t('musicCurators.rail.eyebrow')}</p>
        <h2 className="mcu-h2b uppercase">{t('musicCurators.rail.h2')}</h2>
        <p className="mcu-body"><Trans i18nKey="musicCurators.rail.lead1" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.supervisors} /> }} /></p>
        <p className="mcu-body">{t('musicCurators.rail.lead2')}</p>
        <p className="mcu-body mcu-rail-intro">{t('musicCurators.rail.intro')}</p>

        <div
          className="mcu-rail"
          role="list"
          aria-label={t('musicCurators.rail.listAria')}
        >
          {RAIL_KEYS.map((key, i) => (
            <div className="mcu-row" role="listitem" key={key}>
              <span className="mcu-row-n">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="mcu-row-k">{t(`musicCurators.rail.items.${key}.label`)}</span>
                <span className="mcu-row-o">
                  {/* MB-27 sits on the mood-and-identity item, the only one the map allows for
                      the ambient post. */}
                  <Trans
                    i18nKey={`musicCurators.rail.items.${key}.text`}
                    components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={RAIL_BLOG[key] ?? ''} /> }}
                  />
                </span>
              </span>
              <span className="mcu-row-tr" aria-hidden="true">
                <RailTrace index={i} />
              </span>
            </div>
          ))}
        </div>

        <p className="mcu-pull mcu-rail-close">{t('musicCurators.rail.pull')}</p>
      </div>
    </section>
  );
}

function RailTrace({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <svg className="mcu-sl" viewBox="0 0 240 36">
          <path
            d="M8 22 C 30 10 52 12 74 20 C 96 28 112 26 120 22"
            style={{ color: 'rgba(255,255,255,.45)' }}
          />
          <path
            d="M120 22 C 128 18 144 16 166 22 C 188 28 212 24 232 14"
            style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.5 }}
          />
          <circle cx="120" cy="22" r="2.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
        </svg>
      );
    case 1:
      return (
        <svg className="mcu-sl" viewBox="0 0 240 36">
          <g style={{ color: 'rgba(255,255,255,.12)' }}>
            <line x1="80" y1="6" x2="80" y2="30" strokeDasharray="2 4" />
            <line x1="160" y1="6" x2="160" y2="30" strokeDasharray="2 4" />
          </g>
          <g>
            <circle cx="36" cy="24" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="120" cy="14" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="204" cy="24" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
          </g>
          <path
            className="mcu-dashflow"
            d="M36 24 C 80 6 160 6 204 24"
            style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.4 }}
          />
        </svg>
      );
    case 2:
      return (
        <svg className="mcu-sl" viewBox="0 0 240 36">
          <circle
            cx="24"
            cy="18"
            r="7"
            style={{ color: 'rgba(255,255,255,.8)', strokeWidth: 1.5 }}
          />
          <g style={{ color: 'rgba(238,74,38,.55)' }}>
            <path className="mcu-dashflow" d="M34 18 C 90 8 150 8 226 12" />
            <path className="mcu-dashflow" d="M34 18 C 90 26 150 28 226 26" />
          </g>
        </svg>
      );
    case 3:
      return (
        <svg className="mcu-sl" viewBox="0 0 240 36">
          <g>
            <circle cx="40" cy="18" r="2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
            <circle cx="80" cy="12" r="2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
            <circle cx="120" cy="22" r="2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
            <circle cx="200" cy="14" r="2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
          </g>
          <circle
            className="mcu-glowp"
            cx="160"
            cy="20"
            r="3.5"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <circle cx="160" cy="20" r="8" style={{ color: 'rgba(238,74,38,.4)' }} />
        </svg>
      );
    default:
      return (
        <svg className="mcu-sl" viewBox="0 0 240 36">
          <g style={{ color: 'rgba(255,255,255,.1)' }}>
            <path d="M8 8 H232 M8 28 H232" />
          </g>
          <path
            d="M12 18 C 60 12 110 26 160 16 C 190 10 214 16 230 20"
            style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.5 }}
          />
        </svg>
      );
  }
}
