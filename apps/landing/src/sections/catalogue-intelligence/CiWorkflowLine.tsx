import { useTranslation } from 'react-i18next';
import { drawCls } from './ciEngine.ts';
import { SvgText } from './ciSvgHelpers.tsx';

const STAGES = ['deliver', 'validate', 'profile', 'index', 'search'] as const;

export function CiWorkflowLine() {
  const { t } = useTranslation('common');
  const y = 92;

  return (
    <section id="ci-how" className="ci-section" aria-label="How it works">
      <header className="ci-dim-intro">
        <p className="ci-eyebrow uppercase">{t('catalogueIntelligence.how.eyebrow')}</p>
        <h2 className="ci-h2b uppercase">{t('catalogueIntelligence.how.title')}</h2>
      </header>
      <div className="ci-flowline-wrap">
        <span className="ci-hudlbl ci-hudtop-l uppercase">{t('catalogueIntelligence.how.panelLabel')}</span>
        <span className="ci-truth ci-hudtop-r uppercase">{t('catalogueIntelligence.how.truth')}</span>
        <svg
          className="ci-worksvg"
          viewBox="0 0 1160 190"
          role="img"
          aria-label={t('catalogueIntelligence.how.figureAlt')}
        >
          <line
            x1={30}
            y1={y}
            x2={1130}
            y2={y}
            stroke="rgba(255,255,255,.18)"
            className={drawCls()}
          />
          <circle cx={70} cy={y} r={7} fill="#101010" stroke="#fff" strokeWidth={1.3} />
          <SvgText x={70} y={y - 34} className="ci-slbl" anchor="middle">
            SCOPED
          </SvgText>
          <SvgText x={70} y={y - 20} anchor="middle">
            ACCOUNT
          </SvgText>
          <rect x={250} y={y - 30} width={130} height={60} fill="none" stroke="rgba(255,255,255,.4)" />
          <SvgText x={315} y={y - 42} className="ci-slbl" anchor="middle">
            SFTP + CSV MANIFEST
          </SvgText>
          <SvgText x={315} y={y + 4} anchor="middle">
            controlled delivery
          </SvgText>
          <path
            d={`M540 ${y - 32} L572 ${y} L540 ${y + 32} L508 ${y} Z`}
            fill="none"
            stroke="rgba(255,255,255,.4)"
          />
          <SvgText x={540} y={y - 42} className="ci-slbl" anchor="middle">
            VALIDATION
          </SvgText>
          <path
            d={`M508 ${y} C 470 ${y + 52} 400 ${y + 52} 380 ${y + 8}`}
            stroke="rgba(238,74,38,.6)"
            strokeDasharray="3 4"
            fill="none"
          />
          <SvgText x={455} y={y + 58} anchor="middle">
            feedback
          </SvgText>
          <path
            d={`M720 ${y - 30} h96 l20 30 l-20 30 h-96 l-20 -30 Z`}
            fill="rgba(238,74,38,.06)"
            stroke="#EE4A26"
          />
          <SvgText x={768} y={y - 42} className="ci-slbl ci-slbl-hot" anchor="middle">
            PYXIS-1 PROFILING
          </SvgText>
          <SvgText x={768} y={y + 4} anchor="middle">
            70+ characteristics
          </SvgText>
          <rect
            x={960}
            y={y - 36}
            width={150}
            height={72}
            fill="none"
            stroke="rgba(255,255,255,.35)"
            strokeDasharray="4 5"
          />
          <SvgText x={1035} y={y - 46} className="ci-slbl" anchor="middle">
            PRIVATE CATALOGUE
          </SvgText>
          <SvgText x={1035} y={y + 2} anchor="middle">
            similarity + analysis
          </SvgText>
          <SvgText x={1035} y={y + 18} anchor="middle">
            partner-scoped
          </SvgText>
        </svg>
        <div className="ci-stagegrid">
          {STAGES.map((key) => (
            <div key={key}>
              <span className="ci-n">{t(`catalogueIntelligence.how.stages.${key}.n`)}</span>
              <span className="ci-t uppercase">{t(`catalogueIntelligence.how.stages.${key}.t`)}</span>
              <p>{t(`catalogueIntelligence.how.stages.${key}.p`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
