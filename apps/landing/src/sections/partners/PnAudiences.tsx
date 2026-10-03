import { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
  AUDIENCE_IDS,
  AUDIENCE_ROUTES,
  ROUTE_NAMES,
  type AudienceId,
  type RouteId,
} from './pnData.ts';
import { BLOG } from '@/routes/blogLinks.ts';

/** Blog destination per audience tab, from the interlinking map. Only MB-30 is mapped. */
const AUDIENCE_BLOG: Partial<Record<AudienceId, string>> = { label: BLOG.discoveryRevenue };

interface PnAudiencesProps {
  activePath: RouteId;
  onSelectPath: (id: RouteId) => void;
}

export function PnAudiences({ activePath, onSelectPath }: PnAudiencesProps) {
  const { t } = useTranslation('common');
  const [audience, setAudience] = useState<AudienceId>('label');

  const routes = AUDIENCE_ROUTES[audience];

  const highlightRoute = (rid: RouteId) => {
    onSelectPath(rid);
    document.getElementById('paths')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="audiences" aria-label="Built for the teams that control and use the repertoire" className="pn-section">
      <header className="pn-dim-intro">
        <p className="pn-eyebrow uppercase">{t('partners.audiences.eyebrow')}</p>
        <h2 className="pn-h2b uppercase">{t('partners.audiences.title')}</h2>
      </header>
      <div className="pn-seg" role="group" aria-label={t('partners.audiences.switcherLabel')}>
        {AUDIENCE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={audience === id}
            onClick={() => setAudience(id)}
          >
            {t(`partners.audiences.segments.${id}`)}
          </button>
        ))}
      </div>
      <div className="pn-audpanel">
        <span className="pn-hudlbl pn-hudtop-l uppercase">
          {t(`partners.audiences.profiles.${audience}.label`)}
        </span>
        <div className="pn-aud-ind" aria-live="polite">
          <span className="pn-lbl-dim self-center uppercase">
            {t('partners.audiences.routeIndicator')}
          </span>
          {routes.map((rid) => (
            <button
              key={rid}
              type="button"
              className="pn-rt uppercase"
              aria-label={t('partners.audiences.routeChipAria', { route: ROUTE_NAMES[rid] })}
              aria-pressed={activePath === rid}
              onClick={() => highlightRoute(rid)}
            >
              {ROUTE_NAMES[rid]}
            </button>
          ))}
        </div>
        <div className="pn-audrows">
          <div>
            <span className="pn-k uppercase">{t('partners.audiences.colQuestion')}</span>
            <p>
              {/* MB-30 sits on the Labels question, which is the default tab and therefore the
                  only one prerendered. The map requires the anchor in the server-rendered HTML. */}
              <Trans
                i18nKey={`partners.audiences.profiles.${audience}.question`}
                components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={AUDIENCE_BLOG[audience] ?? ''} /> }}
              />
            </p>
          </div>
          <div>
            <span className="pn-k uppercase">{t('partners.audiences.colRoute')}</span>
            <p>
              <Trans
                i18nKey={`partners.audiences.profiles.${audience}.route`}
                components={{ b: <b /> }}
              />
            </p>
          </div>
          <div>
            <span className="pn-k uppercase">{t('partners.audiences.colConversation')}</span>
            <p>{t(`partners.audiences.profiles.${audience}.conversation`)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
