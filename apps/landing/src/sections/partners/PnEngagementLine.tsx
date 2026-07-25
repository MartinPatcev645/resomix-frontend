import { useCallback, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ENGAGEMENT_STAGES } from './pnData.ts';

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

export function PnEngagementLine() {
  const { t } = useTranslation('common');
  const [selectedStage, setSelectedStage] = useState(0);
  const stage = ENGAGEMENT_STAGES[selectedStage];

  const onKeyDown = (index: number) => (ev: KeyboardEvent<SVGGElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      setSelectedStage(index);
    }
  };

  const selectStage = useCallback((index: number) => setSelectedStage(index), []);

  return (
    <section id="engagement" aria-label="How a partner engagement starts" className="pn-section">
      <header className="pn-dim-intro">
        <p className="pn-eyebrow uppercase">{t('partners.engagement.eyebrow')}</p>
        <h2 className="pn-h2b uppercase">{t('partners.engagement.title')}</h2>
      </header>
      <div className="pn-routeline">
        <figure role="img" aria-label={t('partners.engagement.figureAlt')}>
          <svg viewBox="0 0 1160 96" aria-hidden="true" focusable="false">
            <line
              x1={40}
              y1={52}
              x2={1120}
              y2={52}
              stroke="rgba(255,255,255,.2)"
              className="pn-draw"
            />
            {ENGAGEMENT_STAGES.map((s, i) => {
              const x = 140 + i * 294;
              const on = i === selectedStage;
              return (
                <g
                  key={s.t}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`Stage ${i + 1}: ${s.t}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => selectStage(i)}
                  onKeyDown={onKeyDown(i)}
                >
                  {on ? (
                    <circle
                      cx={x}
                      cy={52}
                      r={12}
                      fill="none"
                      stroke="rgba(238,74,38,.35)"
                      strokeWidth={3}
                    />
                  ) : null}
                  <circle
                    cx={x}
                    cy={52}
                    r={6}
                    fill={on ? '#EE4A26' : '#101010'}
                    stroke={on ? '#EE4A26' : '#fff'}
                    strokeWidth={1.3}
                  />
                  <SvgText
                    x={x}
                    y={32}
                    className={on ? 'pn-slbl pn-slbl-hot' : 'pn-slbl'}
                    anchor="middle"
                  >
                    {`0${i + 1} ${s.t}`}
                  </SvgText>
                </g>
              );
            })}
          </svg>
        </figure>
        <div className="pn-engage-mobile" role="group" aria-label={t('partners.engagement.mobileLabel')}>
          {ENGAGEMENT_STAGES.map((s, i) => (
            <button
              key={s.t}
              type="button"
              className="pn-eg-station uppercase"
              aria-pressed={i === selectedStage}
              onClick={() => selectStage(i)}
            >
              {`0${i + 1}  ${s.t}`}
            </button>
          ))}
        </div>
        <div className="pn-engage-detail">
          <span className="pn-hudlbl uppercase">{`STAGE 0${selectedStage + 1} · ${stage.t}`}</span>
          <div className="pn-egcols">
            <div>
              <span className="pn-k uppercase">{t('partners.engagement.colYou')}</span>
              <p>{stage.you}</p>
            </div>
            <div>
              <span className="pn-k uppercase">{t('partners.engagement.colResomix')}</span>
              <p>{stage.rx}</p>
            </div>
            <div>
              <span className="pn-k uppercase">{t('partners.engagement.colNext')}</span>
              <p>{stage.next}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="pn-lbl-dim mt-[var(--px-16)]">{t('partners.engagement.footnote')}</p>
    </section>
  );
}
