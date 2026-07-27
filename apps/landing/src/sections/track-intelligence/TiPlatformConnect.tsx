import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SvgText } from './tiSvgHelpers.tsx';
import { drawCls } from './tiEngine.ts';

const ROUTES = [
  { key: 'sonic' as const, col: 480, dash: false, stroke: '#EE4A26' },
  { key: 'catalogue' as const, col: 730, dash: true, stroke: '#fff' },
  { key: 'api' as const, col: 1010, dash: true, stroke: '#fff' },
];

export function TiPlatformConnect() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const handleLink = (key: 'sonic' | 'catalogue' | 'api') => {
    if (key === 'sonic') {
      navigate('/product/sonic-discovery');
      return;
    }
    if (key === 'catalogue') {
      navigate('/product/catalog-intelligence');
      return;
    }
    navigate('/developers');
  };

  return (
    <section id="ti-platform" className="ti-section" aria-label="Connection to the Resomix platform">
      <header className="ti-dim-intro">
        <p className="ti-eyebrow uppercase">{t('trackIntelligence.platform.eyebrow')}</p>
        <h2 className="ti-h2b uppercase">{t('trackIntelligence.platform.title')}</h2>
      </header>

      <div className="ti-connect">
        <span className="ti-hudlbl ti-hudtop-l uppercase">{t('trackIntelligence.platform.diagramLabel')}</span>
        <svg viewBox="0 0 1160 150" role="img" aria-label={t('trackIntelligence.platform.diagramAlt')}>
          <circle cx={90} cy={75} r={7} fill="#EE4A26" />
          <SvgText x={90} y={40} className="ti-slbl" anchor="middle">
            TRACK PROFILE
          </SvgText>
          <SvgText x={90} y={56} anchor="middle">
            basalt room · sample
          </SvgText>
          <path
            d="M97 75 H 420"
            stroke="rgba(255,255,255,.4)"
            strokeWidth={1.2}
            fill="none"
            className={drawCls()}
          />
          {ROUTES.map(({ key, col, dash }, i) => (
            <g key={key}>
              <path
                d={`M420 75 C ${440 + i * 20} 75 ${col - 60} 75 ${col - 14} 75`}
                stroke="rgba(255,255,255,.3)"
                strokeDasharray={dash ? '3 5' : 'none'}
                fill="none"
                className={drawCls()}
              />
              <circle
                cx={col}
                cy={75}
                r={5}
                fill="#101010"
                stroke={key === 'sonic' ? '#EE4A26' : '#fff'}
                strokeWidth={1.3}
              />
              <SvgText x={col} y={46} className="ti-slbl" anchor="middle">
                {t(`trackIntelligence.platform.routes.${key}.node`)}
              </SvgText>
              <SvgText x={col} y={110} anchor="middle">
                {t(`trackIntelligence.platform.routes.${key}.status`)}
              </SvgText>
            </g>
          ))}
        </svg>

        <div className="ti-connect-ctas">
          {ROUTES.map(({ key }) => (
            <div key={key}>
              <p>{t(`trackIntelligence.platform.routes.${key}.copy`)}</p>
              <button type="button" className="ti-bracket" onClick={() => handleLink(key)}>
                {t(`trackIntelligence.platform.routes.${key}.link`)}
              </button>
              <span className="ti-lbl-dim">
                {key === 'api'
                  ? t(`trackIntelligence.platform.routes.${key}.status`)
                  : `${t(`trackIntelligence.platform.routes.${key}.statusLabel`)} ${t(`trackIntelligence.platform.routes.${key}.status`)}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
