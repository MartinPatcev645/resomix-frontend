import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

export function HmAudiences() {
  const { t } = useTranslation('common');

  return (
    <section className="hm-section" id="hm-audiences">
      <div className="hm-frame">
        <h2 className="hm-sr">{t('home.audiences.srTitle')}</h2>
        <p className="hm-eyebrow uppercase">{t('home.audiences.eyebrow')}</p>
        <div className="hm-aud-band">
          <div className="hm-aud">
          <div className="hm-a">
            <div className="hm-tr" aria-hidden="true"><svg className="hm-sl" viewBox="0 0 160 40"><path d="M4 34 C 40 34 52 8 84 8 C 112 8 126 24 156 28" style={{color: 'rgba(238,74,38,.55)', strokeWidth: 1.4}}/></svg></div>
            <span className="hm-ak">{t('home.audiences.djs.label')}</span>
            <span className="hm-ao"><Trans i18nKey="home.audiences.djs.outcome" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.techno} /> }} /></span>
          </div>
          <div className="hm-a">
            <div className="hm-tr" aria-hidden="true"><svg className="hm-sl" viewBox="0 0 160 40"><g style={{color: 'rgba(255,255,255,.4)'}}><rect x="4" y="20" width="34" height="14"/><rect x="44" y="10" width="34" height="24"/><rect x="84" y="16" width="34" height="18"/><rect x="124" y="6" width="32" height="28"/></g></svg></div>
            <span className="hm-ak">{t('home.audiences.producers.label')}</span>
            <span className="hm-ao">{t('home.audiences.producers.outcome')}</span>
          </div>
          <div className="hm-a">
            <div className="hm-tr" aria-hidden="true"><svg className="hm-sl" viewBox="0 0 160 40"><g style={{color: 'rgba(255,255,255,.4)'}}><path d="M8 12 H80 M8 21 H64 M8 30 H72"/><circle cx="120" cy="12" r="2.2"/><circle cx="120" cy="21" r="2.2"/><circle cx="120" cy="30" r="2.2"/></g></svg></div>
            <span className="hm-ak">{t('home.audiences.curators.label')}</span>
            <span className="hm-ao"><Trans i18nKey="home.audiences.curators.outcome" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.supervisors} /> }} /></span>
          </div>
          <div className="hm-a">
            <div className="hm-tr" aria-hidden="true"><svg className="hm-sl" viewBox="0 0 160 40"><g style={{color: 'rgba(255,255,255,.4)'}}><rect x="14" y="22" width="52" height="9"/><rect x="20" y="10" width="40" height="9"/></g><circle className="hm-glowp" cx="120" cy="26" r="3.6" style={{fill: '#EE4A26', stroke: 'none'}}/></svg></div>
            <span className="hm-ak">{t('home.audiences.labels.label')}</span>
            <span className="hm-ao"><Trans i18nKey="home.audiences.labels.outcome" components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={BLOG.backCatalogue} /> }} /></span>
          </div>
          <div className="hm-a">
            <div className="hm-tr" aria-hidden="true"><svg className="hm-sl" viewBox="0 0 160 40"><g style={{color: 'rgba(255,255,255,.4)'}}><path d="M24 8 L12 20 L24 32 M56 8 L68 20 L56 32"/><path d="M92 20 H148" strokeDasharray="3 4" style={{color: 'rgba(238,74,38,.5)'}}/></g></svg></div>
            <span className="hm-ak">{t('home.audiences.platforms.label')}</span>
            <span className="hm-ao">{t('home.audiences.platforms.outcome')}</span>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
