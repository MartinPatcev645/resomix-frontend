import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

export function HmStatement() {
  const { t } = useTranslation('common');

  return (
    <section className="hm-statement hm-section" id="hm-statement">
      <div className="hm-frame">
        <h2 className="hm-h2b uppercase">{t('home.statement.head')}</h2>
        <p className="hm-sub"><Trans i18nKey="home.statement.sub" components={{ a: <a href={BLOG.beyondTags} /> }} /></p>
        <div className="hm-gesture" aria-hidden="true">
          <svg className="hm-sl" viewBox="0 0 1152 90">
          {/* the sound itself */}
          <path d="M0 58 C 70 12 150 96 230 50 C 300 16 360 78 420 52" style={{color: 'rgba(255,255,255,.5)', strokeWidth: 1.6}}/>
          {/* calibration gate */}
          <line x1="452" y1="14" x2="452" y2="82" style={{color: 'rgba(238,74,38,.6)'}}/>
          <line x1="460" y1="14" x2="460" y2="82" style={{color: 'rgba(238,74,38,.25)'}}/>
          {/* measured continuation */}
          <path d="M460 52 H510 V40 H570 V62 H630 V46 H690 V58 H750 V42 H810 V52 H850" style={{color: 'rgba(255,255,255,.42)'}}/>
          {/* resolve into a ranked result */}
          <g style={{color: 'rgba(255,255,255,.2)'}}>
            <path d="M850 52 C 890 52 902 25 938 25"/>
            <path d="M850 52 C 890 52 902 45 938 45"/>
            <path d="M850 52 C 890 52 902 65 938 65"/>
            <path d="M850 52 C 890 52 902 85 938 85"/>
          </g>
          <rect className="hm-f" x="942" y="20" width="190" height="10" style={{color: 'rgba(238,74,38,.8)'}}/>
          <g style={{color: 'rgba(255,255,255,.35)'}}>
            <rect x="942" y="40" width="150" height="10"/>
            <rect x="942" y="60" width="115" height="10"/>
            <rect x="942" y="80" width="85" height="10"/>
          </g>
        </svg>
          <div className="hm-caps">
            <span>{t('home.statement.capSound')}</span>
            <span>{t('home.statement.capChars')}</span>
            <span>{t('home.statement.capResult')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
