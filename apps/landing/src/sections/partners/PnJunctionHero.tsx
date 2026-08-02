import { useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ROUTE_DEST,
  ROUTE_IDS,
  ROUTE_Y,
  type RouteId,
} from './pnData.ts';

function SvgText({
  x,
  y,
  className,
  anchor,
  children,
}: {
  x: number;
  y: number;
  className?: string;
  anchor?: 'middle' | 'end';
  children: React.ReactNode;
}) {
  return (
    <text x={x} y={y} className={className} textAnchor={anchor}>
      {children}
    </text>
  );
}

function statusClass(st: string): string {
  if (st === 'LIVE') return 'pn-st-live';
  if (st.includes('SCOPING')) return 'pn-st-plan';
  return 'pn-st-avail';
}

interface JunctionSvgProps {
  activePath: RouteId;
  onSelectPath: (id: RouteId) => void;
}

function JunctionSvg({ activePath, onSelectPath }: JunctionSvgProps) {
  const { t } = useTranslation('common');

  const onKeyDown = (id: RouteId) => (ev: KeyboardEvent<SVGGElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onSelectPath(id);
    }
  };

  const signalBars = (() => {
    let seed = 20260723;
    const rand = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let tVal = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      tVal = (tVal + Math.imul(tVal ^ (tVal >>> 7), 61 | tVal)) ^ tVal;
      return ((tVal ^ (tVal >>> 14)) >>> 0) / 4294967296;
    };
    let d = '';
    for (let i = 0; i < 22; i++) {
      const bh = 18 * (0.4 + 0.6 * rand());
      d += `M${14 + i * 6} ${172 - bh / 2}L${14 + i * 6} ${172 + bh / 2}`;
    }
    return d;
  })();

  return (
    <svg viewBox="0 0 1160 300" aria-hidden="true" focusable="false">
      <SvgText x={14} y={132} className="pn-slbl">
        {t('partners.junction.inbound1')}
      </SvgText>
      <SvgText x={14} y={150} className="pn-slbl">
        {t('partners.junction.inbound2')}
      </SvgText>
      <path d={signalBars} stroke="#fff" strokeWidth={2} opacity={0.8} fill="none" />
      <path
        d="M150 150 H 320"
        stroke="rgba(255,255,255,.35)"
        fill="none"
        className="pn-draw"
      />
      <circle cx={330} cy={150} r={8} fill="#101010" stroke="#EE4A26" strokeWidth={1.4} />
      <SvgText x={330} y={124} className="pn-smicro pn-slbl-hot" anchor="middle">
        {t('partners.junction.nodeLabel')}
      </SvgText>
      {ROUTE_IDS.map((id, i) => {
        const y = ROUTE_Y[id];
        const on = id === activePath;
        const title = t(`partners.routes.${id}.title`);
        const st = t(`partners.routes.${id}.status`);
        const dest = ROUTE_DEST[id];
        return (
          <g
            key={id}
            role="button"
            tabIndex={0}
            aria-label={`Route ${i + 1}: ${title} — ${st}. Opens its detail panel.`}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectPath(id)}
            onKeyDown={onKeyDown(id)}
          >
            <path
              d={`M338 150 C 420 150 420 ${y} 500 ${y}`}
              stroke={on ? '#EE4A26' : 'rgba(255,255,255,.25)'}
              strokeWidth={on ? 1.8 : 1.2}
              fill="none"
              className={`pn-draw pn-d${i + 1}`}
            />
            {on ? (
              <rect
                x={497}
                y={y - 27}
                width={526}
                height={54}
                fill="none"
                stroke="rgba(238,74,38,.25)"
                strokeWidth={4}
              />
            ) : null}
            <rect
              x={500}
              y={y - 24}
              width={520}
              height={48}
              fill={on ? 'rgba(238,74,38,.06)' : 'none'}
              stroke={on ? '#EE4A26' : 'rgba(255,255,255,.25)'}
              strokeWidth={on ? 1.4 : 1}
            />
            <SvgText x={518} y={y - 2} className={on ? 'pn-slbl pn-slbl-hot' : 'pn-slbl'}>
              {`0${i + 1} ${title}`}
            </SvgText>
            <SvgText x={518} y={y + 15} className="pn-smicro">
              {`destination: ${dest}`}
            </SvgText>
            <SvgText x={1004} y={y + 4} className={on ? 'pn-smicro pn-slbl-hot' : 'pn-smicro'} anchor="end">
              {st}
            </SvgText>
            <path
              d={`M1020 ${y} H 1080`}
              stroke={on ? 'rgba(238,74,38,.5)' : 'rgba(255,255,255,.18)'}
              strokeDasharray="2 4"
              fill="none"
            />
            <circle
              cx={1090}
              cy={y}
              r={4}
              fill={on ? '#EE4A26' : '#101010'}
              stroke={on ? '#EE4A26' : '#fff'}
              strokeWidth={1.2}
            />
          </g>
        );
      })}
      <SvgText x={14} y={286} className="pn-smicro">
        {t('partners.junction.footerLeft')}
      </SvgText>
      <SvgText x={1146} y={286} className="pn-smicro" anchor="end">
        {t('partners.junction.footerRight')}
      </SvgText>
    </svg>
  );
}

interface PnJunctionHeroProps {
  activePath: RouteId;
  onSelectPath: (id: RouteId) => void;
}

export function PnJunctionHero({ activePath, onSelectPath }: PnJunctionHeroProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const routeCtaDest = ROUTE_DEST[activePath];
  const outcomeTitle = t(`partners.routes.${activePath}.outcomeTitle`);
  const outcomeNote = t(`partners.routes.${activePath}.note`);
  const routeCta = t(`partners.routes.${activePath}.cta`);

  const goPilot = useCallback(() => navigate('/partners/pilot'), [navigate]);
  const goApi = useCallback(() => navigate('/developers'), [navigate]);
  const goContact = useCallback(() => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleRouteCta = useCallback(() => {
    if (routeCtaDest.startsWith('#')) {
      document.getElementById(routeCtaDest.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(routeCtaDest);
    }
  }, [navigate, routeCtaDest]);

  return (
    <section id="hero" aria-label="Partner with Resomix" className="pn-section">
      <div className="pn-hero-head">
        <p className="pn-eyebrow uppercase">
          {t('partners.hero.eyebrowPrefix')}{' '}
          <span className="pn-o">{t('partners.hero.eyebrowHighlight')}</span>{' '}
          {t('partners.hero.eyebrowSuffix')}
        </p>
        {/* Mobile (<768px) base is the shared landing mobile hero size: var(--px-32) / 1.06 / 18ch,
            matching .rl-benzin on the solutions pages. Do not swap it back to a bespoke value.
            md:/lg: keep the tablet + desktop sizes exactly as they were. */}
        <h1 className="font-benzin uppercase text-[length:var(--px-32)] leading-[1.06] max-w-[18ch] md:max-w-none md:text-[length:var(--px-64)] md:leading-[var(--px-68)] lg:text-[length:var(--px-72)] lg:leading-[var(--px-76)] mb-[var(--px-24)]">
          {t('partners.hero.title')}
        </h1>
        <p className="pn-body pn-sub">{t('partners.hero.sub')}</p>
        <div className="pn-ctarow">
          <button type="button" className="pn-pill pn-pill-solid uppercase" onClick={goPilot}>
            {t('partners.hero.ctaPilot')}
          </button>
          <button type="button" className="pn-pill pn-pill-line uppercase" onClick={goApi}>
            {t('partners.hero.ctaApi')}
          </button>
          <button type="button" className="pn-bracket" onClick={goContact}>
            {t('partners.hero.ctaContact')}
          </button>
        </div>
        <p className="pn-trustline uppercase">{t('partners.hero.trustline')}</p>
      </div>

      <div className="pn-junction">
        <span className="pn-hudlbl pn-hudtop-l uppercase">{t('partners.junction.label')}</span>
        <span className="pn-truth pn-hudtop-r uppercase">{t('partners.junction.truth')}</span>
        <figure
          role="img"
          aria-label={t('partners.junction.figureAlt')}
        >
          <JunctionSvg activePath={activePath} onSelectPath={onSelectPath} />
        </figure>
        <div className="pn-junct-foot">
          <p className="pn-interp" aria-live="polite">
            <b>{outcomeTitle}</b> {outcomeNote}
          </p>
          <button type="button" className="pn-pill pn-pill-line uppercase" onClick={handleRouteCta}>
            {routeCta}
          </button>
        </div>
        <div className="pn-junction-mobile" aria-label={t('partners.junction.mobileLabel')}>
          {ROUTE_IDS.map((id, i) => (
            <button
              key={id}
              type="button"
              className="pn-jm-route"
              onClick={() => {
                onSelectPath(id);
                document.getElementById('paths')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span className="pn-n">{`0${i + 1}`}</span>
              <span>
                <span className="pn-t">{t(`partners.routes.${id}.panelTitle`)}</span>
                <span className="pn-d">{t(`partners.routes.${id}.mobileDesc`)}</span>
              </span>
              <span className={`pn-st ${statusClass(t(`partners.routes.${id}.status`))}`}>
                {t(`partners.routes.${id}.status`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
