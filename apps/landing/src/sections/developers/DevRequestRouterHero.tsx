import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES, ROUTE_STATUS, type RouteKey, drawCls, API_DOCS_URL } from './devEngine.ts';
import { SvgText } from './devSvgHelpers.tsx';
import { HeroTitle } from '@/components/HeroTitle.tsx';

const ROUTE_BTNS: RouteKey[] = ['search', 'sim', 'ana'];

function DesktopRouter({ route }: { route: RouteKey }) {
  const lanes: [RouteKey, string, string, number][] = [
    ['search', 'SEARCH', 'GET /api/v1/search_tracks/', 95],
    ['sim', 'SIMILARITY', 'similarity/search · similarity/upload', 195],
    ['ana', 'ANALYSIS', 'analysis: upload · status · result', 295],
  ];

  return (
    <svg viewBox="0 0 1160 400" aria-hidden="true" focusable="false" className="dev-router-d">
      <SvgText x={14} y={66} className="dev-smicro">
        REQUEST
      </SvgText>
      <rect x={14} y={78} width={210} height={74} fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.25)" />
      <SvgText x={26} y={102} className="dev-smicro" fill="#B9B9B9">
        POST /api/v1/…
      </SvgText>
      <SvgText x={26} y={122} className="dev-smicro">
        Authorization: Bearer
      </SvgText>
      <SvgText x={26} y={138} className="dev-smicro">
        rmx_live_xxxx…
      </SvgText>
      <path d="M224 115 H 306" stroke="rgba(255,255,255,.35)" fill="none" className={drawCls()} />
      <circle cx={316} cy={115} r={8} fill="#101010" stroke="#EE4A26" strokeWidth={1.4} />
      <SvgText x={316} y={94} className="dev-smicro dev-slbl-hot" anchor="middle">
        SCOPED GATE
      </SvgText>
      <rect
        x={340}
        y={22}
        width={600}
        height={330}
        fill="rgba(255,255,255,.012)"
        stroke="rgba(255,255,255,.3)"
        strokeDasharray="5 6"
      />
      <SvgText x={356} y={44} className="dev-slbl">
        YOUR PRIVATE CATALOGUE BOUNDARY
      </SvgText>
      <SvgText x={924} y={44} className="dev-smicro" anchor="end">
        PARTNER-SCOPED
      </SvgText>
      {lanes.map(([key, label, ep, y]) => {
        const on = key === route;
        return (
          <g key={key}>
            {on ? (
              <rect
                x={377}
                y={y - 31}
                width={526}
                height={62}
                fill="none"
                stroke="rgba(238,74,38,.25)"
                strokeWidth={4}
              />
            ) : null}
            <rect
              x={380}
              y={y - 28}
              width={520}
              height={56}
              fill={on ? 'rgba(238,74,38,.06)' : 'none'}
              stroke={on ? '#EE4A26' : 'rgba(255,255,255,.22)'}
              strokeWidth={on ? 1.4 : 1}
            />
            <SvgText x={398} y={y - 4} className={on ? 'dev-slbl dev-slbl-hot' : 'dev-slbl'}>
              {label}
            </SvgText>
            <SvgText x={398} y={y + 16} className="dev-smicro">
              {ep}
            </SvgText>
            <SvgText
              x={884}
              y={y + 4}
              className={on ? 'dev-smicro dev-slbl-hot' : 'dev-smicro'}
              anchor="end"
            >
              {ROUTE_STATUS[key]}
            </SvgText>
            {on ? (
              <>
                <path
                  d={`M324 115 C 350 115 350 ${y} 380 ${y}`}
                  stroke="#EE4A26"
                  strokeWidth={1.6}
                  fill="none"
                  className={drawCls()}
                />
                <path
                  d={`M900 ${y} C 930 ${y} 930 168 958 168`}
                  stroke="#EE4A26"
                  strokeWidth={1.6}
                  fill="none"
                  className={drawCls('dev-d2')}
                />
              </>
            ) : null}
          </g>
        );
      })}
      <path d="M640 352 V 378" stroke="rgba(255,255,255,.25)" strokeDasharray="3 4" fill="none" />
      <SvgText x={652} y={382} className="dev-smicro">
        PLAYBACK ROUTE · PERMISSION-GATED · PROVISIONED PARTNERS ONLY
      </SvgText>
      <SvgText x={958} y={120} className="dev-smicro">
        RESPONSE
      </SvgText>
      <rect x={958} y={132} width={190} height={74} fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.25)" />
      <SvgText x={968} y={154} className="dev-smicro" fill="#B9B9B9">
        {'{ "success": true,'}
      </SvgText>
      <SvgText x={968} y={172} className="dev-smicro">
        {ROUTES[route].frag.slice(0, 26)}
      </SvgText>
      <SvgText x={968} y={190} className="dev-smicro">
        {'…structured json }'}
      </SvgText>
    </svg>
  );
}

function MobileRouter({ route }: { route: RouteKey }) {
  const lanes: [RouteKey, string, number][] = [
    ['search', 'SEARCH', 150],
    ['sim', 'SIMILARITY', 220],
    ['ana', 'ANALYSIS', 290],
  ];

  return (
    <svg viewBox="0 0 360 430" aria-hidden="true" focusable="false" className="dev-router-m">
      <SvgText x={12} y={20} className="dev-slbl">
        REQUEST · Bearer rmx_live_xxxx…
      </SvgText>
      <path d="M180 30 V 52" stroke="rgba(255,255,255,.35)" fill="none" />
      <circle cx={180} cy={60} r={6} fill="#101010" stroke="#EE4A26" strokeWidth={1.3} />
      <SvgText x={180} y={84} className="dev-smicro dev-slbl-hot" anchor="middle">
        SCOPED GATE
      </SvgText>
      <rect
        x={14}
        y={96}
        width={332}
        height={250}
        fill="rgba(255,255,255,.012)"
        stroke="rgba(255,255,255,.3)"
        strokeDasharray="5 6"
      />
      <SvgText x={26} y={116} className="dev-slbl">
        YOUR PRIVATE CATALOGUE
      </SvgText>
      {lanes.map(([key, label, y]) => {
        const on = key === route;
        return (
          <g key={key}>
            <rect
              x={30}
              y={y - 22}
              width={300}
              height={44}
              fill={on ? 'rgba(238,74,38,.06)' : 'none'}
              stroke={on ? '#EE4A26' : 'rgba(255,255,255,.22)'}
            />
            <SvgText x={44} y={y + 4} className={on ? 'dev-slbl dev-slbl-hot' : 'dev-slbl'}>
              {label}
            </SvgText>
            <SvgText x={316} y={y + 4} className={on ? 'dev-slbl dev-slbl-hot' : 'dev-slbl-dim'} anchor="end">
              {ROUTE_STATUS[key]}
            </SvgText>
          </g>
        );
      })}
      <SvgText x={180} y={368} className="dev-slbl" anchor="middle">
        ↓ structured json returns
      </SvgText>
      <SvgText x={180} y={392} className="dev-slbl-dim" anchor="middle">
        playback: permission-gated
      </SvgText>
      <SvgText x={180} y={414} className="dev-slbl-dim" anchor="middle">
        no shared public catalogue
      </SvgText>
    </svg>
  );
}

export function DevRequestRouterHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [route, setRoute] = useState<RouteKey>('sim');

  const glanceItems = t('developers.glance.items', { returnObjects: true }) as {
    text: string;
    highlight?: string;
  }[];

  const handlePilot = useCallback(() => {
    navigate('/partners/pilot');
  }, [navigate]);

  return (
    <section id="dev-hero" className="dev-section rx-hero-pad" aria-label="Resomix API introduction">
      <div className="dev-hero-head">
        <p className="dev-eyebrow uppercase">
          {t('developers.hero.eyebrowPrefix')}{' '}
          <span className="dev-o">{t('developers.hero.eyebrowLive')}</span>
          {t('developers.hero.eyebrowSuffix')}
        </p>
        <h1 className="font-benzin dev-benzin-d uppercase"><HeroTitle text={t('developers.hero.title')} emClass="dev-em" /></h1>
        <p className="dev-body dev-sub">{t('developers.hero.sub')}</p>
        <div className="dev-ctarow">
          <button type="button" className="dev-pill dev-pill-solid uppercase" onClick={handlePilot}>
            {t('developers.hero.ctaPrimary')}
          </button>
          <a
            className="dev-pill dev-pill-line uppercase"
            href={API_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('developers.hero.ctaSecondary')}
          </a>
        </div>
        <p className="dev-trustline uppercase">{t('developers.hero.trustline')}</p>
      </div>

      <div className="dev-glance" aria-label="API at a glance">
        <span className="dev-hudlbl uppercase">{t('developers.glance.label')}</span>
        <ul>
          {glanceItems.map((item) => (
            <li key={item.text} className="uppercase">
              {item.text}
              {item.highlight ? (
                <>
                  {' '}
                  · <b>{item.highlight}</b>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="dev-router">
        <span className="dev-hudlbl dev-hudtop-l uppercase">{t('developers.hero.routerLabel')}</span>
        <span className="dev-truth dev-hudtop-r uppercase">{t('developers.hero.routerTruth')}</span>
        <div className="dev-routepick" role="group" aria-label="Choose a route">
          {ROUTE_BTNS.map((key) => (
            <button
              key={key}
              type="button"
              className="dev-iconbtn uppercase"
              aria-pressed={route === key}
              onClick={() => setRoute(key)}
            >
              {t(`developers.hero.routes.${key}`)}
            </button>
          ))}
        </div>
        <figure role="img" aria-label={t('developers.hero.routerAlt')}>
          <DesktopRouter route={route} />
          <MobileRouter route={route} />
        </figure>
        <div className="dev-viz-foot">
          <span className="dev-lbl uppercase" aria-live="polite">
            {ROUTES[route].note}
          </span>
          <span className="dev-lbl-dim uppercase">{t('developers.hero.routerFoot')}</span>
        </div>
      </div>
    </section>
  );
}
