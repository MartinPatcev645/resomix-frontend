import { useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { STAGES } from './ppData.ts';
import { HeroTitle } from '@/components/HeroTitle.tsx';

interface PpProtocolHeroProps {
  selectedStage: number;
  onSelectStage: (index: number) => void;
  onScrollToMethod: () => void;
}

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

function ProtocolRailSvg({
  selectedStage,
  onSelectStage,
  onScrollToMethod,
}: {
  selectedStage: number;
  onSelectStage: (index: number) => void;
  onScrollToMethod: () => void;
}) {
  const y = 64;

  const handleStation = useCallback(
    (index: number) => {
      onSelectStage(index);
      onScrollToMethod();
    },
    [onSelectStage, onScrollToMethod],
  );

  const onKeyDown = (index: number) => (ev: KeyboardEvent<SVGGElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      handleStation(index);
    }
  };

  return (
    <svg viewBox="0 0 1160 150" className="pp-protosvg">
      <line
        x1={40}
        y1={y}
        x2={1120}
        y2={y}
        stroke="rgba(255,255,255,.2)"
        className="pp-draw"
      />
      {STAGES.map((stage, i) => {
        const x = 90 + i * 196;
        const isLast = i === STAGES.length - 1;
        return (
          <g
            key={stage.t}
            role="link"
            tabIndex={0}
            aria-label={`Stage ${i + 1}: ${stage.t}, ${stage.s}. Opens the method section.`}
            className="pp-proto-node"
            onClick={() => handleStation(i)}
            onKeyDown={onKeyDown(i)}
            data-active={i === selectedStage ? 'true' : undefined}
          >
            {isLast ? (
              <circle
                cx={x}
                cy={y}
                r={13}
                fill="none"
                stroke="#EE4A26"
                strokeDasharray="2 3"
              />
            ) : null}
            <circle
              cx={x}
              cy={y}
              r={6}
              fill={isLast ? '#EE4A26' : '#101010'}
              stroke={isLast ? '#EE4A26' : '#fff'}
              strokeWidth={1.3}
            />
            <SvgText
              x={x}
              y={y - 24}
              className={isLast ? 'pp-slbl pp-slbl-hot' : 'pp-slbl'}
              anchor="middle"
            >
              {`0${i + 1} ${stage.t}`}
            </SvgText>
            <SvgText x={x} y={y + 30} className="pp-smicro" anchor="middle">
              {stage.s}
            </SvgText>
          </g>
        );
      })}
      <SvgText x={40} y={120} className="pp-smicro">
        ONE REPRESENTATIVE SAMPLE, START TO DECISION
      </SvgText>
      <SvgText x={1120} y={120} className="pp-smicro" anchor="end">
        EVIDENCE AT EVERY STAGE
      </SvgText>
    </svg>
  );
}

export function PpProtocolHero({
  selectedStage,
  onSelectStage,
  onScrollToMethod,
}: PpProtocolHeroProps) {
  const { t } = useTranslation('common');

  const glanceItems = t('partnersPilot.hero.glanceItems', {
    returnObjects: true,
  }) as string[];

  const mobileStages = t('partnersPilot.hero.mobileStages', {
    returnObjects: true,
  }) as { title: string; body: string }[];

  return (
    <section id="hero" aria-label="Private Catalogue Pilot introduction" className="pp-section rx-hero-pad">
      <div className="pp-hero-head">
        <p className="pp-eyebrow uppercase">
          {t('partnersPilot.hero.eyebrowPrefix')}{' '}
          <span className="pp-o">{t('partnersPilot.hero.eyebrowHighlight')}</span>{' '}
          {t('partnersPilot.hero.eyebrowSuffix')}
        </p>
        {/* Mobile (<768px) base is the shared landing mobile hero size: var(--px-32) / 1.06 / 18ch,
            matching .rl-benzin on the solutions pages. Do not swap it back to a bespoke value.
            md:/lg: keep the tablet + desktop sizes exactly as they were. */}
        <h1 className="font-benzin uppercase font-black text-[length:var(--px-32)] leading-[1.06] max-w-[18ch] md:max-w-none md:text-[length:var(--px-36)] lg:text-[length:var(--px-48)] mb-[var(--px-24)]">
          <HeroTitle text={t('partnersPilot.hero.title')} emClass="pp-em" />
        </h1>
        <p className="pp-body pp-sub">{t('partnersPilot.hero.sub')}</p>
        <div className="pp-ctarow">
          <a className="pp-pill pp-pill-solid" href="#apply">
            {t('partnersPilot.hero.ctaPrimary')}
          </a>
          <a className="pp-pill pp-pill-line" href="#method">
            {t('partnersPilot.hero.ctaSecondary')}
          </a>
        </div>
        <p className="pp-trustline uppercase">{t('partnersPilot.hero.trustline')}</p>
      </div>

      <div className="pp-glance" aria-label="Pilot at a glance">
        <span className="pp-hudlbl uppercase">{t('partnersPilot.hero.glanceLabel')}</span>
        <ul>
          {glanceItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="pp-protocol">
        <span className="pp-hudlbl pp-hudtop-l uppercase">
          {t('partnersPilot.hero.protocolLabel')}
        </span>
        <span className="pp-truth pp-hudtop-r uppercase">
          {t('partnersPilot.shared.timelineTruth')}
        </span>
        <figure aria-label={t('partnersPilot.hero.protocolAria')}>
          <ProtocolRailSvg
            selectedStage={selectedStage}
            onSelectStage={onSelectStage}
            onScrollToMethod={onScrollToMethod}
          />
        </figure>
        <div className="pp-proto-mobile" aria-label="The pilot protocol, six stages">
          <ol>
            {mobileStages.map((stage) => (
              <li key={stage.title}>
                <span>
                  <span className="pp-proto-mobile-t uppercase">{stage.title}</span>
                  <p>{stage.body}</p>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="pp-proto-note">
          <span className="pp-lbl uppercase">{t('partnersPilot.hero.protocolNote')}</span>
          <span className="pp-lbl-dim uppercase">{t('partnersPilot.hero.protocolNoteDim')}</span>
        </div>
      </div>
    </section>
  );
}
