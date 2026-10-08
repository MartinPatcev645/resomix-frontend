import Link from 'next/link'
import { RichText } from '@/components/RichText'
import { t } from '@/lib/i18n'
import { BLOG } from '@/lib/blog'
import { BETA_URL } from '@/lib/site'

export function HmFinalCta() {
  return (
    <section className="hm-section hm-final" id="hm-final">
      <div className="hm-frame">
        <h2 className="hm-h2b uppercase">{t('home.final.head')}</h2>
        <p className="hm-body"><RichText i18nKey="home.final.body" href={BLOG.story} /></p>
        <div className="hm-paths" aria-hidden="true">
          <svg className="hm-sl" viewBox="0 0 1152 140">
          {/* the hero's dimensions return */}
          <g style={{color: 'rgba(255,255,255,.22)'}}>
            <path d="M176 0 C 200 46 480 56 566 68"/>
            <path d="M376 0 C 390 40 500 56 570 68"/>
            <path d="M576 0 V62"/>
            <path d="M776 0 C 762 40 652 56 582 68"/>
            <path d="M976 0 C 952 46 672 56 586 68"/>
          </g>
          {/* the engine */}
          <circle cx="576" cy="72" r="5.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
          <circle cx="576" cy="72" r="12" style={{color: 'rgba(238,74,38,.45)'}}/>
          {/* two paths: the primary carries the signal */}
          <path className="hm-dashflow" d="M576 78 C 500 108 384 116 304 130" style={{color: 'rgba(238,74,38,.9)', strokeWidth: 2.2}}/>
          <circle cx="300" cy="130" r="4" style={{fill: '#EE4A26', stroke: 'none'}}/>
          <path d="M576 78 C 652 108 768 116 848 130" strokeDasharray="4 5" style={{color: 'rgba(255,255,255,.42)', strokeWidth: 1.4}}/>
          <circle cx="852" cy="130" r="3.5" style={{color: 'rgba(255,255,255,.5)'}}/>
        </svg>
          <div className="hm-caps">
            <span>{t('home.final.capIndiv')}</span>
            <span>{t('home.final.capCatalogues')}</span>
          </div>
        </div>
        <div className="hm-fork">
          <div className="hm-f hm-pro">
            <span className="hm-who">{t('home.final.fork1who')}</span>
            <p className="hm-fdork">{t('home.final.fork1d')}</p>
            <a className="hm-cta-p" href={BETA_URL}>{t('home.final.fork1cta')}</a>
          </div>
          <div className="hm-f">
            <span className="hm-who">{t('home.final.fork2who')}</span>
            <p className="hm-fdork">{t('home.final.fork2d')}</p>
            <Link className="hm-cta-s" href="/partners/pilot">
              {t('home.final.fork2cta')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
