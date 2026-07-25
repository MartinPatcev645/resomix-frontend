import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BASE_BETA_URL } from '@resomix/config';
import {
  REFS,
  rankedList,
  barsPath,
  energyD,
  ridgeD,
  blocksRowOf,
  pulsesOf,
  type Track,
} from './sdEngine.ts';

interface SdSearchFieldHeroProps {
  heroSel: number;
  onSelectHero: (i: number) => void;
  motionOn: boolean;
  onScrollToConsole: () => void;
}

type HeroBandsCfg = {
  gx: number;
  gw: number;
  bands: {
    groove: { y: number; h: number; ly: number };
    energy: { y: number; h: number; ly: number };
    timbre: { y: number; h: number; ly: number };
    struct: { y: number; h: number; ly: number };
  };
};

const heroRef = REFS.int;

function heroBandsCfg(desktop: boolean): HeroBandsCfg {
  return desktop
    ? {
        gx: 190,
        gw: 670,
        bands: {
          groove: { y: 50, h: 90, ly: 40 },
          energy: { y: 190, h: 85, ly: 180 },
          timbre: { y: 325, h: 85, ly: 315 },
          struct: { y: 460, h: 85, ly: 450 },
        },
      }
    : {
        gx: 12,
        gw: 336,
        bands: {
          groove: { y: 126, h: 74, ly: 118 },
          energy: { y: 238, h: 70, ly: 230 },
          timbre: { y: 350, h: 70, ly: 342 },
          struct: { y: 462, h: 70, ly: 454 },
        },
      };
}

const BAND_NAMES: Record<keyof HeroBandsCfg['bands'], string> = {
  groove: 'GROOVE',
  energy: 'ENERGY',
  timbre: 'TIMBRE',
  struct: 'STRUCTURE',
};

function drawClassName(extra?: string) {
  return extra ? `sd-draw ${extra}` : 'sd-draw';
}

function renderEyebrow(text: string) {
  const highlight = 'live in beta';
  const idx = text.toLowerCase().indexOf(highlight);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="sd-o">{text.slice(idx, idx + highlight.length)}</span>
      {text.slice(idx + highlight.length)}
    </>
  );
}

function renderTitle(title: string) {
  const dotIdx = title.indexOf('. ');
  if (dotIdx === -1) return title;
  return (
    <>
      {title.slice(0, dotIdx + 1)}
      <br />
      {title.slice(dotIdx + 2)}
    </>
  );
}

function ReferencePulses({
  desktop,
  cfg,
}: {
  desktop: boolean;
  cfg: HeroBandsCfg;
}) {
  const groove = cfg.bands.groove;
  const pulses = pulsesOf(
    heroRef.t,
    heroRef.dens,
    cfg.gx,
    groove.y + groove.h - 6,
    cfg.gw,
    groove.h - 14,
    desktop ? 44 : 30,
  );

  return (
    <>
      {pulses.map((p, i) => (
        <rect
          key={i}
          x={p.x.toFixed(1)}
          y={p.y.toFixed(1)}
          width={p.width.toFixed(1)}
          height={p.height.toFixed(1)}
          fill={p.acc ? '#fff' : 'rgba(255,255,255,.6)'}
          opacity={p.acc ? 0.95 : 0.65}
        />
      ))}
    </>
  );
}

function CandidatePulses({
  desktop,
  cfg,
  track,
}: {
  desktop: boolean;
  cfg: HeroBandsCfg;
  track: Track;
}) {
  const groove = cfg.bands.groove;
  const pulses = pulsesOf(
    track.t,
    track.dens,
    cfg.gx,
    groove.y + groove.h - 6,
    cfg.gw,
    groove.h - 14,
    desktop ? 44 : 30,
  );

  return (
    <>
      {pulses.map((p, i) => (
        <rect
          key={i}
          x={p.x.toFixed(1)}
          y={p.y.toFixed(1)}
          width={p.width.toFixed(1)}
          height={p.height.toFixed(1)}
          fill="none"
          stroke="#EE4A26"
          strokeWidth={1}
          opacity={0.9}
        />
      ))}
    </>
  );
}

function StructureBlocks({
  name,
  x0,
  y0,
  w,
  h,
  color,
  withLabels,
}: {
  name: string;
  x0: number;
  y0: number;
  w: number;
  h: number;
  color: string;
  withLabels: boolean;
}) {
  return (
    <>
      {blocksRowOf(name, x0, y0, w, h, color, withLabels).map((b, i) => (
        <g key={i}>
          <rect
            x={b.x.toFixed(1)}
            y={b.y}
            width={b.w.toFixed(1)}
            height={b.h}
            fill="none"
            stroke={b.hot ? '#EE4A26' : color}
            strokeWidth={b.hot ? 1.4 : 1}
            opacity={b.hot ? 0.95 : 0.8}
          />
          {b.showLabel && (
            <text x={b.x + 5} y={b.y + b.h - 7} className="sd-slbl-dim">
              {b.label}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

function HeroSvg({
  desktop,
  selectedTrack,
}: {
  desktop: boolean;
  selectedTrack: Track | undefined;
}) {
  const cfg = heroBandsCfg(desktop);
  const struct = cfg.bands.struct;

  return (
    <>
      {desktop ? (
        <>
          <text x={8} y={18} className="sd-slbl">
            REFERENCE IN
          </text>
          <path
            className={drawClassName()}
            d={barsPath(heroRef.t, 8, 70, 124, 84, 26)}
            stroke="#fff"
            strokeWidth={2}
            opacity={0.85}
            fill="none"
          />
          <text x={8} y={132} className="sd-slbl-dim">
            {heroRef.t}
          </text>
          <line
            x1={150}
            y1={24}
            x2={150}
            y2={540}
            stroke="rgba(255,255,255,.2)"
            strokeDasharray="1 5"
          />
          <text x={150} y={16} className="sd-slbl" textAnchor="middle">
            PYXIS-1
          </text>
          <circle cx={150} cy={70} r={3} fill="#EE4A26" />
          {(['groove', 'energy', 'timbre', 'struct'] as const).map((bk, i) => {
            const b = cfg.bands[bk];
            const cy = b.y + b.h / 2;
            return (
              <path
                key={`gate-${bk}`}
                className={drawClassName(`sd-d${i + 1}`)}
                d={`M150 70 C 165 70 170 ${cy} ${cfg.gx} ${cy}`}
                stroke="rgba(255,255,255,.28)"
                fill="none"
              />
            );
          })}
          {(['groove', 'energy', 'timbre', 'struct'] as const).map((bk, i) => {
            const b = cfg.bands[bk];
            const cy = b.y + b.h / 2;
            return (
              <path
                key={`conv-${bk}`}
                className={drawClassName(`sd-d${i + 1}`)}
                d={`M${cfg.gx + cfg.gw} ${cy} C 872 ${cy} 872 ${240 + i * 26} 878 ${240 + i * 26}`}
                stroke="rgba(255,255,255,.22)"
                fill="none"
              />
            );
          })}
          <text x={876} y={222} className="sd-slbl" textAnchor="end">
            → RANKED
          </text>
        </>
      ) : (
        <>
          <text x={12} y={16} className="sd-slbl">
            REFERENCE IN · {heroRef.t}
          </text>
          <path
            className={drawClassName()}
            d={barsPath(heroRef.t, 12, 52, 336, 56, 40)}
            stroke="#fff"
            strokeWidth={2}
            opacity={0.85}
            fill="none"
          />
          <line
            x1={12}
            y1={94}
            x2={348}
            y2={94}
            stroke="rgba(255,255,255,.2)"
            strokeDasharray="1 5"
          />
          <text x={180} y={110} className="sd-slbl" textAnchor="middle">
            PYXIS-1 READS THE SIGNAL
          </text>
          <text x={180} y={608} className="sd-slbl-dim" textAnchor="middle">
            RANKED MATCHES BELOW ↓
          </text>
        </>
      )}

      {(Object.keys(cfg.bands) as Array<keyof HeroBandsCfg['bands']>).map((bk) => {
        const b = cfg.bands[bk];
        return (
          <g key={`band-${bk}`}>
            <text x={cfg.gx} y={b.ly} className="sd-slbl">
              {BAND_NAMES[bk]}
            </text>
            <line
              x1={cfg.gx}
              y1={b.y + b.h + 8}
              x2={cfg.gx + cfg.gw}
              y2={b.y + b.h + 8}
              stroke="rgba(255,255,255,.08)"
              strokeDasharray="1 4"
            />
          </g>
        );
      })}

      <g className="sd-hx-ref">
        <ReferencePulses desktop={desktop} cfg={cfg} />
        <path
          className={drawClassName('sd-d2')}
          d={energyD(heroRef, cfg.gx, cfg.bands.energy.y, cfg.gw, cfg.bands.energy.h - 8)}
          stroke="#fff"
          strokeWidth={1.6}
          fill="none"
          opacity={0.85}
        />
        <path
          d={ridgeD(
            heroRef.t,
            1,
            heroRef.bright,
            cfg.gx,
            cfg.bands.timbre.y + cfg.bands.timbre.h - 4,
            cfg.gw,
            cfg.bands.timbre.h - 10,
            true,
          )}
          fill="rgba(255,255,255,.06)"
          stroke="rgba(255,255,255,.55)"
          strokeWidth={1}
        />
        <path
          d={ridgeD(
            heroRef.t,
            2,
            heroRef.bright * 0.7,
            cfg.gx,
            cfg.bands.timbre.y + cfg.bands.timbre.h - 4,
            cfg.gw,
            cfg.bands.timbre.h - 26,
            false,
          )}
          fill="none"
          stroke="rgba(255,255,255,.3)"
          strokeWidth={1}
        />
        <StructureBlocks
          name={heroRef.t}
          x0={cfg.gx}
          y0={struct.y + 6}
          w={cfg.gw}
          h={struct.h - 26}
          color="rgba(255,255,255,.5)"
          withLabels={desktop}
        />
      </g>

      {selectedTrack && (
        <g className="sd-hx-cand">
          <CandidatePulses desktop={desktop} cfg={cfg} track={selectedTrack} />
          <path
            d={energyD(selectedTrack, cfg.gx, cfg.bands.energy.y, cfg.gw, cfg.bands.energy.h - 8)}
            stroke="#EE4A26"
            strokeWidth={1.6}
            fill="none"
            opacity={0.9}
          />
          <path
            d={ridgeD(
              selectedTrack.t,
              1,
              selectedTrack.bright,
              cfg.gx,
              cfg.bands.timbre.y + cfg.bands.timbre.h - 4,
              cfg.gw,
              cfg.bands.timbre.h - 10,
              false,
            )}
            fill="none"
            stroke="#EE4A26"
            strokeWidth={1.3}
            opacity={0.9}
          />
          <StructureBlocks
            name={selectedTrack.t}
            x0={cfg.gx}
            y0={struct.y + struct.h - 16}
            w={cfg.gw}
            h={10}
            color="rgba(238,74,38,.9)"
            withLabels={false}
          />
        </g>
      )}
    </>
  );
}

export function SdSearchFieldHero({
  heroSel,
  onSelectHero,
  motionOn,
  onScrollToConsole,
}: SdSearchFieldHeroProps) {
  const { t } = useTranslation('common');
  const stagewrapRef = useRef<HTMLDivElement>(null);
  const heroList = useMemo(() => rankedList(REFS.int), []);
  const selectedTrack = heroList[heroSel]?.t;

  useEffect(() => {
    if (!motionOn || !('IntersectionObserver' in window)) return;

    const host = stagewrapRef.current;
    if (!host) return;

    host.querySelectorAll('.sd-draw').forEach((p) => {
      const path = p as SVGPathElement;
      try {
        const len = path.getTotalLength ? Math.ceil(path.getTotalLength()) : 800;
        path.style.strokeDasharray = String(len);
        path.style.setProperty('--len', String(len));
        path.style.strokeDashoffset = String(len);
        path.classList.add('sd-armed');
      } catch {
        /* non-path or unsupported */
      }
    });

    const settle = (p: Element) => {
      const el = p as SVGPathElement;
      el.style.strokeDasharray = 'none';
      el.style.strokeDashoffset = '0';
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting && en.intersectionRatio <= 0) return;
          io.unobserve(en.target);
          en.target.querySelectorAll('.sd-draw').forEach((p) => {
            p.classList.add('sd-play');
            p.addEventListener('animationend', () => settle(p), { once: true });
            setTimeout(() => settle(p), 1400);
          });
        });
      },
      { threshold: [0, 0.01] },
    );

    io.observe(host);
    return () => io.disconnect();
  }, [motionOn]);

  return (
    <section id="sd-hero" className="sd-section" aria-label="Sonic Discovery introduction">
      <div className="sd-hero-head">
        <p className="sd-eyebrow uppercase">{renderEyebrow(t('sonicDiscovery.hero.eyebrow'))}</p>
        <h1 className="font-benzin uppercase text-[length:var(--px-38)] lg:text-[length:var(--px-70)] leading-[1.04] m-0 mb-[var(--px-24)]">
          {renderTitle(t('sonicDiscovery.hero.title'))}
        </h1>
        <p className="sd-body sd-sub">{t('sonicDiscovery.hero.sub')}</p>
        <div className="sd-ctarow">
          <a className="sd-pill sd-pill-solid uppercase" href={BASE_BETA_URL}>
            {t('sonicDiscovery.hero.ctaPrimary')}
          </a>
          <button
            type="button"
            className="sd-pill sd-pill-line uppercase"
            onClick={onScrollToConsole}
          >
            {t('sonicDiscovery.hero.ctaSecondary')}
          </button>
        </div>
      </div>

      <div className="sd-hero-field">
        <div className="sd-hero-stagewrap" ref={stagewrapRef}>
          <span className="sd-hudlbl uppercase">{t('sonicDiscovery.hero.fieldLabel')}</span>
          <span className="sd-hud-truth sd-truth uppercase">SAMPLE DATA</span>
          <figure
            className="sd-herofig"
            role="img"
            aria-label={t('sonicDiscovery.hero.figureAlt')}
          >
            <svg
              id="sd-herosvg-d"
              className="sd-herosvg-d"
              viewBox="0 0 880 560"
              aria-hidden="true"
              focusable="false"
            >
              <HeroSvg desktop selectedTrack={selectedTrack} />
            </svg>
            <svg
              id="sd-herosvg-m"
              className="sd-herosvg-m"
              viewBox="0 0 360 620"
              aria-hidden="true"
              focusable="false"
            >
              <HeroSvg desktop={false} selectedTrack={selectedTrack} />
            </svg>
          </figure>
        </div>

        <div
          className="sd-stack"
          role="group"
          aria-label="Ranked matches — select one to compare its sonic profile against the reference"
        >
          <span className="sd-lbl sd-stack-lbl uppercase">
            {t('sonicDiscovery.hero.stackLabel')} ·{' '}
            <span>
              {t('sonicDiscovery.hero.stackComparing')} 0{heroSel + 1}
            </span>
          </span>
          {heroList.map((item, i) => (
            <button
              key={item.t.t}
              type="button"
              className="sd-stackbtn min-h-[var(--px-44)]"
              aria-pressed={i === heroSel}
              onClick={() => onSelectHero(i)}
            >
              <span className="sd-rk">0{i + 1}</span>
              <span className="sd-tt">
                {item.t.t}
                <span className="sd-aa">{item.t.a}</span>
              </span>
              <span className="sd-sc">{item.sc}</span>
            </button>
          ))}
          <span className="sd-lbl-dim uppercase">{t('sonicDiscovery.hero.stackHint')}</span>
        </div>
      </div>

      <div className="sd-hero-caption">
        <span className="sd-lbl uppercase">
          {t('sonicDiscovery.hero.refCaption')}{' '}
          <span className="text-[var(--color-primary)]">
            {heroRef.t} — {heroRef.a}
          </span>{' '}
          · {heroRef.bpm} BPM · {heroRef.key}
        </span>
        <span className="sd-lbl-dim uppercase">{t('sonicDiscovery.hero.refCaptionNote')}</span>
      </div>
    </section>
  );
}
