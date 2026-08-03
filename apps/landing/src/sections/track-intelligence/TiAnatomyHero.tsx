import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BASE_BETA_URL } from '@resomix/config';
import {
  TRACK,
  LENS,
  type LensKey,
  eAt,
  contourD,
  sectionBlocks,
  waveBarsPath,
  timbreRidgePath,
  SECTIONS,
} from './tiEngine.ts';
import { SvgText } from './tiSvgHelpers.tsx';
import { drawCls } from './tiEngine.ts';
import { HeroTitle } from '@/components/HeroTitle.tsx';

function renderBoldHtml(html: string) {
  const parts = html.split(/(<b>.*?<\/b>)/g);
  return parts.map((part, i) => {
    if (part.startsWith('<b>') && part.endsWith('</b>')) {
      return <b key={i}>{part.slice(3, -4)}</b>;
    }
    return part;
  });
}

function renderEyebrow(text: string) {
  const highlight = 'BETA · SAMPLE DATA';
  const idx = text.indexOf(highlight);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="ti-o">{highlight}</span>
      {text.slice(idx + highlight.length)}
    </>
  );
}

type AnatomySvgProps = {
  desktop: boolean;
  lens: LensKey;
  motionReduced: boolean;
};

function AnatomySvg({ desktop, lens, motionReduced }: AnatomySvgProps) {
  const x0 = desktop ? 150 : 12;
  const w = desktop ? 970 : 336;

  const laneCls = (key: LensKey) =>
    `ti-lane${lens !== key && !motionReduced ? ' ti-lane-dim' : ''}`;

  if (desktop) {
    const blocks = sectionBlocks(x0, 58, w, 44, true, -1);
    const energyFill =
      contourD(eAt, x0, 128, w, 80, 0, 1) + ' L' + (x0 + w) + ' 208 L' + x0 + ' 208 Z';
    const peakX = x0 + w * (289 / TRACK.dur);
    const peakY = 128 + 80 - 0.95 * 80;

    return (
      <svg viewBox="0 0 1160 520" aria-hidden="true" focusable="false">
        <SvgText x={12} y={262} className="ti-slbl">
          SPINE
        </SvgText>
        <SvgText x={12} y={278}>
          waveform
        </SvgText>
        <path
          d={waveBarsPath('anat', x0, 266, w, 64, 150)}
          stroke="rgba(255,255,255,.8)"
          strokeWidth={1.2}
          fill="none"
        />
        <line x1={x0} y1={266} x2={x0 + w} y2={266} stroke="rgba(255,255,255,.12)" strokeDasharray="1 4" />

        <g className={laneCls('structure')} data-lane="structure">
          <SvgText x={12} y={78} className="ti-slbl">
            STRUCTURE
          </SvgText>
          {blocks.map((b) => (
            <g key={b.label}>
              <rect
                x={b.x}
                y={58}
                width={b.width}
                height={44}
                fill="none"
                stroke={b.isDrop ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.3)'}
                strokeWidth={1}
              />
              <SvgText x={b.x + 6} y={74}>{b.label}</SvgText>
              <SvgText x={b.x + 6} y={98}>{b.duration}</SvgText>
            </g>
          ))}
        </g>

        <g className={laneCls('energy')} data-lane="energy">
          <SvgText x={12} y={166} className="ti-slbl">
            ENERGY
          </SvgText>
          <path d={energyFill} fill="rgba(255,255,255,.05)" stroke="none" />
          <path
            d={contourD(eAt, x0, 128, w, 80, 0, 1)}
            stroke="#fff"
            strokeWidth={1.6}
            fill="none"
            opacity={0.85}
            className={drawCls()}
          />
          <circle cx={peakX} cy={peakY} r={4} fill="#EE4A26" />
        </g>

        <g className={laneCls('harmony')} data-lane="harmony">
          <SvgText x={12} y={342} className="ti-slbl">
            HARMONY
          </SvgText>
          <rect x={x0} y={322} width={w} height={36} fill="none" stroke="rgba(255,255,255,.25)" />
          {SECTIONS.map((s) => {
            const bx = x0 + (s.t0 / TRACK.dur) * w;
            const bw = ((s.t1 - s.t0) / TRACK.dur) * w;
            const agree = s.n === 'BREAK' ? 0.5 : 0.88;
            return (
              <rect
                key={s.n}
                x={bx + 2}
                y={322 + 36 * (1 - agree)}
                width={bw - 6}
                height={36 * agree}
                fill={s.n === 'BREAK' ? 'rgba(238,74,38,.25)' : 'rgba(255,255,255,.16)'}
              />
            );
          })}
          <SvgText x={x0 + 6} y={350}>
            g min agreement
          </SvgText>
        </g>

        <g className={laneCls('timbre')} data-lane="timbre">
          <SvgText x={12} y={412} className="ti-slbl">
            TIMBRE
          </SvgText>
          <path
            d={timbreRidgePath('anat-t', x0, 452, w, 44)}
            stroke="rgba(255,255,255,.6)"
            strokeWidth={1.2}
            fill="none"
          />
          <rect
            x={x0 + w * (252 / TRACK.dur)}
            y={396}
            width={w * (74 / TRACK.dur)}
            height={56}
            fill="none"
            stroke="#EE4A26"
            strokeDasharray="2 4"
          />
          <SvgText x={x0 + w * (252 / TRACK.dur) + 6} y={408}>
            brighter
          </SvgText>
        </g>

        <g className={laneCls('identity')} data-lane="identity">
          <SvgText x={12} y={492} className="ti-slbl">
            IDENTITY
          </SvgText>
          {['DEEP HOUSE 0.62', 'DARK', 'HYPNOTIC', 'SYNTH-LED', 'NO VOCALS'].map((c, ci) => (
            <g key={c}>
              <rect
                x={x0 + ci * 196}
                y={474}
                width={180}
                height={28}
                fill="none"
                stroke={ci === 0 ? '#EE4A26' : 'rgba(255,255,255,.25)'}
              />
              <SvgText x={x0 + ci * 196 + 10} y={492} className={ci === 0 ? 'ti-slbl ti-slbl-hot' : 'ti-slbl-dim'}>
                {c}
              </SvgText>
            </g>
          ))}
        </g>
      </svg>
    );
  }

  const mobileLanes: { key: LensKey; label: string; y: number; render: (y: number) => React.ReactNode }[] = [
    {
      key: 'structure',
      label: 'STRUCTURE',
      y: 110,
      render: (y) => {
        const blocks = sectionBlocks(12, y + 10, 336, 34, false, -1);
        return blocks.map((b) => (
          <rect
            key={b.label}
            x={b.x}
            y={y + 10}
            width={b.width}
            height={34}
            fill="none"
            stroke={b.isDrop ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.3)'}
            strokeWidth={1}
          />
        ));
      },
    },
    {
      key: 'energy',
      label: 'ENERGY',
      y: 198,
      render: (y) => (
        <path
          d={contourD(eAt, 12, y + 10, 336, 56, 0, 1)}
          stroke="#fff"
          strokeWidth={1.4}
          fill="none"
          opacity={0.85}
        />
      ),
    },
    {
      key: 'harmony',
      label: 'HARMONY',
      y: 286,
      render: (y) => (
        <>
          <rect x={12} y={y + 10} width={336} height={30} fill="none" stroke="rgba(255,255,255,.25)" />
          {SECTIONS.map((s) => {
            const bx = 12 + (s.t0 / TRACK.dur) * 336;
            const bw = ((s.t1 - s.t0) / TRACK.dur) * 336;
            const agree = s.n === 'BREAK' ? 0.5 : 0.88;
            return (
              <rect
                key={s.n}
                x={bx + 1}
                y={y + 10 + 30 * (1 - agree)}
                width={bw - 3}
                height={30 * agree}
                fill={s.n === 'BREAK' ? 'rgba(238,74,38,.25)' : 'rgba(255,255,255,.16)'}
              />
            );
          })}
        </>
      ),
    },
    {
      key: 'timbre',
      label: 'TIMBRE',
      y: 374,
      render: (y) => (
        <path
          d={timbreRidgePath('anat-tm', 12, y + 52, 336, 30)}
          stroke="rgba(255,255,255,.6)"
          strokeWidth={1.1}
          fill="none"
        />
      ),
    },
    {
      key: 'identity',
      label: 'IDENTITY',
      y: 462,
      render: (y) =>
        ['DEEP HOUSE 0.62', 'DARK · HYPNOTIC', 'SYNTH-LED'].map((c, ci) => (
          <g key={c}>
            <rect
              x={12 + ci * 114}
              y={y + 10}
              width={106}
              height={26}
              fill="none"
              stroke={ci === 0 ? '#EE4A26' : 'rgba(255,255,255,.25)'}
            />
            <SvgText x={12 + ci * 114 + 6} y={y + 27} className={ci === 0 ? 'ti-slbl-dim ti-slbl-hot' : 'ti-slbl-dim'}>
              {c}
            </SvgText>
          </g>
        )),
    },
  ];

  return (
    <svg viewBox="0 0 360 560" aria-hidden="true" focusable="false">
      <SvgText x={12} y={20} className="ti-slbl">
        SPINE · WAVEFORM
      </SvgText>
      <path
        d={waveBarsPath('anat', 12, 58, 336, 52, 90)}
        stroke="rgba(255,255,255,.8)"
        strokeWidth={1.2}
        fill="none"
      />
      {mobileLanes.map(({ key, label, y, render }) => (
        <g key={key} className={laneCls(key)} data-lane={key}>
          <SvgText x={12} y={y} className="ti-slbl">
            {label}
          </SvgText>
          {render(y)}
        </g>
      ))}
    </svg>
  );
}

const LENS_KEYS: LensKey[] = ['structure', 'energy', 'harmony', 'timbre', 'identity'];

type TiAnatomyHeroProps = {
  motionOn: boolean;
  onScrollToStructure: () => void;
};

export function TiAnatomyHero({ motionOn, onScrollToStructure }: TiAnatomyHeroProps) {
  const { t } = useTranslation('common');
  const [lens, setLens] = useState<LensKey>('structure');
  const motionReduced = !motionOn;

  const lensInterp = useMemo(() => LENS[lens].i, [lens]);

  return (
    <section id="ti-hero" className="ti-section" aria-label="Track Intelligence introduction">
      <div className="ti-hero-head">
        <p className="ti-eyebrow uppercase">{renderEyebrow(t('trackIntelligence.hero.eyebrow'))}</p>
        <h1 className="ti-benzin-d font-benzin uppercase">
          <HeroTitle text={t('trackIntelligence.hero.title')} emClass="ti-em" />
        </h1>
        <p className="ti-body ti-sub">{t('trackIntelligence.hero.sub')}</p>
        <div className="ti-ctarow">
          <a className="ti-pill ti-pill-solid uppercase" href={BASE_BETA_URL}>
            {t('trackIntelligence.hero.ctaPrimary')}
          </a>
          <button type="button" className="ti-pill ti-pill-line uppercase" onClick={onScrollToStructure}>
            {t('trackIntelligence.hero.ctaSecondary')}
          </button>
        </div>
      </div>

      <div className="ti-anatomy">
        <span className="ti-hudlbl ti-hudtop-l uppercase">{t('trackIntelligence.hero.anatomyLabel')}</span>
        <span className="ti-truth ti-hudtop-r uppercase">{t('trackIntelligence.hero.sampleData')}</span>

        <div className="ti-lensrow">
          <div className="ti-seg" role="group" aria-label="Analysis layer lens">
            {LENS_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={lens === key}
                onClick={() => setLens(key)}
              >
                {t(`trackIntelligence.hero.lens.${key}`)}
              </button>
            ))}
          </div>
          <div className="ti-trackid">
            <span className="ti-chip">
              <b>{TRACK.t}</b> — {TRACK.a}
            </span>
            <span className="ti-chip">
              <b>{TRACK.bpm}</b> BPM
            </span>
            <span className="ti-chip">
              <b>{TRACK.key.split(' · ')[0]}</b> · {TRACK.key.split(' · ')[1]}
            </span>
            <span className="ti-chip">
              <b>{TRACK.lufs}</b> LUFS
            </span>
            <span className="ti-chip">
              <b>6:18</b>
            </span>
          </div>
        </div>

        <figure
          role="img"
          aria-label={t('trackIntelligence.hero.figureAlt')}
        >
          <div className="ti-anat-d">
            <AnatomySvg desktop lens={lens} motionReduced={motionReduced} />
          </div>
          <div className="ti-anat-m">
            <AnatomySvg desktop={false} lens={lens} motionReduced={motionReduced} />
          </div>
        </figure>

        <div className="ti-anat-caption">
          <p className="ti-interp" aria-live="polite">
            {renderBoldHtml(lensInterp)}
          </p>
          <span className="ti-truth uppercase">{t('trackIntelligence.hero.interpLabel')}</span>
        </div>
      </div>
    </section>
  );
}
