import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_DOCS_INGESTION_REQUIREMENTS_URL, drawCls } from './devEngine.ts';
import { SvgText } from './devSvgHelpers.tsx';

function IngestRailSvg() {
  const y = 70;
  return (
    <svg
      viewBox="0 0 1160 165"
      role="img"
      aria-label="Ingestion rail: an isolated SFTP area receives audio files, a CSV manifest and a dot-done marker sent last. The batch passes through validation, PYXIS-1 processing and private indexing, ending at ready with a webhook notification to the partner. Sample diagram."
      className="dev-ingestsvg"
    >
      <line x1={30} y1={y} x2={1130} y2={y} stroke="rgba(255,255,255,.18)" className={drawCls()} />
      <rect x={44} y={y - 30} width={150} height={60} fill="none" stroke="rgba(255,255,255,.4)" />
      <SvgText x={119} y={y - 38} className="dev-slbl" anchor="middle">
        ISOLATED SFTP
      </SvgText>
      <SvgText x={119} y={y - 8} className="dev-smicro" anchor="middle">
        audio + manifest.csv
      </SvgText>
      <rect x={78} y={y + 2} width={44} height={16} fill="rgba(0,0,0,.4)" stroke="rgba(238,74,38,.6)" />
      <SvgText x={100} y={y + 14} className="dev-smicro dev-slbl-hot" anchor="middle">
        .done
      </SvgText>
      <SvgText x={148} y={y + 14} className="dev-smicro">
        sent last
      </SvgText>
      <path
        d={`M262 ${y - 28} L290 ${y} L262 ${y + 28} L234 ${y} Z`}
        fill="none"
        stroke="rgba(255,255,255,.4)"
      />
      <SvgText x={262} y={y - 38} className="dev-slbl" anchor="middle">
        VALIDATION
      </SvgText>
      <path
        d={`M380 ${y - 24} h104 l16 24 l-16 24 h-104 l-16 -24 Z`}
        fill="rgba(238,74,38,.06)"
        stroke="#EE4A26"
      />
      <SvgText x={432} y={y - 34} className="dev-slbl dev-slbl-hot" anchor="middle">
        PYXIS-1 PROCESSING
      </SvgText>
      <SvgText x={432} y={y + 4} className="dev-smicro" anchor="middle">
        70+ characteristics
      </SvgText>
      <rect
        x={552}
        y={y - 24}
        width={126}
        height={48}
        fill="none"
        stroke="rgba(255,255,255,.4)"
        strokeDasharray="4 5"
      />
      <SvgText x={615} y={y - 34} className="dev-slbl" anchor="middle">
        PRIVATE INDEX
      </SvgText>
      <SvgText x={615} y={y + 2} className="dev-smicro" anchor="middle">
        built / rebuilt
      </SvgText>
      <circle cx={770} cy={y} r={6} fill="#EE4A26" />
      <SvgText x={770} y={y - 20} className="dev-sval dev-slbl-hot" anchor="middle">
        READY
      </SvgText>
      <path
        d={`M777 ${y} C 840 ${y} 860 ${y - 22} 918 ${y - 22}`}
        stroke="rgba(238,74,38,.6)"
        strokeDasharray="3 4"
        fill="none"
        className={drawCls('dev-d2')}
      />
      <SvgText x={924} y={y - 18} className="dev-smicro">
        WEBHOOK → PARTNER NOTIFICATION
      </SvgText>
      {['RECEIVED', 'VALIDATING', 'PROCESSING', 'INDEXING', 'READY'].map((s, i) => (
        <SvgText
          key={s}
          x={150 + i * 210}
          y={150}
          className={i === 4 ? 'dev-slbl dev-slbl-hot' : 'dev-smicro'}
          anchor="middle"
        >
          {`${s}${i < 4 ? '  →' : ''}`}
        </SvgText>
      ))}
    </svg>
  );
}

export function DevIngestionRail() {
  const { t } = useTranslation('common');
  const [checksOpen, setChecksOpen] = useState(false);

  const steps = t('developers.ingestion.mobileSteps', { returnObjects: true }) as (
    | string
    | { text: string; bold?: string; suffix?: string }
  )[];
  const checks = t('developers.ingestion.checks', { returnObjects: true }) as { title: string; body: string }[];

  return (
    <section id="dev-ingestion" className="dev-section" aria-label="Catalogue ingestion">
      <header className="dev-dim-intro">
        <p className="dev-eyebrow uppercase">{t('developers.ingestion.eyebrow')}</p>
        <h2 className="dev-h2b uppercase">{t('developers.ingestion.title')}</h2>
        <p className="dev-lead">{t('developers.ingestion.lead')}</p>
      </header>
      <div className="dev-rail-wrap">
        <span className="dev-hudlbl dev-hudtop-l uppercase">{t('developers.ingestion.railLabel')}</span>
        <span className="dev-truth dev-hudtop-r uppercase">{t('developers.ingestion.railTruth')}</span>
        <IngestRailSvg />
        <div className="dev-ingest-mobile">
          <div className="dev-async uppercase">
            <span className="dev-stt">RECEIVED</span>
            <span className="dev-arr">→</span>
            <span className="dev-stt">VALIDATING</span>
            <span className="dev-arr">→</span>
            <span className="dev-stt">PROCESSING</span>
            <span className="dev-arr">→</span>
            <span className="dev-stt">INDEXING</span>
            <span className="dev-arr">→</span>
            <span className="dev-stt dev-stt-on">READY</span>
          </div>
          <p className="dev-lbl-dim dev-ingest-mobile-note uppercase">
            {t('developers.ingestion.mobileNote')}
          </p>
        </div>
        <div className="dev-ingest-mobile-steps">
          <ol>
            {steps.map((step, i) => (
              <li key={i}>
                {typeof step === 'string' ? (
                  step
                ) : (
                  <>
                    {step.text}
                    {step.bold ? <b>{step.bold}</b> : null}
                    {step.suffix ?? null}
                  </>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="dev-ghostbtn dev-m-disclose uppercase"
            aria-expanded={checksOpen}
            aria-controls="dev-valwrap"
            onClick={() => setChecksOpen((v) => !v)}
          >
            {checksOpen
              ? t('developers.ingestion.checksOpen')
              : t('developers.ingestion.checksClosed')}
          </button>
        </div>
        <div
          className={`dev-valmsgs${checksOpen ? ' dev-open' : ''}`}
          id="dev-valwrap"
          aria-label="Example validation outcomes"
        >
          {checks.map((c) => (
            <div key={c.title}>
              <span className="dev-vt uppercase">{c.title}</span>
              {c.body}
            </div>
          ))}
        </div>
        <div className="dev-viz-foot">
          <span className="dev-lbl-dim">{t('developers.ingestion.formats')}</span>
          <a
            className="dev-bracket uppercase"
            href={API_DOCS_INGESTION_REQUIREMENTS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('developers.ingestion.requirementsLink')}
          </a>
        </div>
      </div>
      <p className="dev-lbl-dim dev-footnote">{t('developers.ingestion.footnote')}</p>
    </section>
  );
}
