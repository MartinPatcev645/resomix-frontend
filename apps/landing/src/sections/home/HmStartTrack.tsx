import { useTranslation } from 'react-i18next';
import { BASE_BETA_URL } from '@resomix/config';

export function HmStartTrack() {
  const { t } = useTranslation('common');

  return (
    <section className="hm-section" id="hm-how">
      <div className="hm-frame">
        <p className="hm-eyebrow uppercase">{t('home.how.eyebrow')}</p>
        <h2 className="hm-h2b uppercase">{t('home.how.head')}</h2>
        <div className="hm-flow">
          <div className="hm-fstage">
            <span className="hm-fstep"><b>01</b>{t('home.how.step01')}</span>
            <span className="hm-fsub">{t('home.how.step01sub')}</span>
            <div className="hm-ftile">
              <span className="hm-fk">{t('home.how.tileSearchK')}</span>
              <span className="hm-fd">{t('home.how.tileSearchD')}</span>
            </div>
            <div className="hm-ftile">
              <span className="hm-fk">{t('home.how.tileDropK')}</span>
              <span className="hm-fd">{t('home.how.tileDropD')}</span>
            </div>
          </div>
          <div className="hm-join" aria-hidden="true">
            <svg viewBox="0 0 44 32"><g style={{stroke:'currentColor', fill:'none', strokeWidth:1.4, strokeLinecap:'round', strokeLinejoin:'round'}}><path d="M2 8 C 16 8 22 16 30 16 M2 24 C 16 24 22 16 30 16 M30 16 H38 M34 11 L40 16 L34 21"/></g></svg>
          </div>
          <div className="hm-fstage">
            <span className="hm-fstep"><b>02</b>{t('home.how.step02')}</span>
            <div className="hm-fcard">
              <svg className="hm-sl" viewBox="0 0 200 44" aria-hidden="true"><polyline points="0,36 26,30 48,20 74,18 92,28 112,24 124,10 152,8 176,14 200,24" style={{strokeWidth: 1.6}}/></svg>
              <span className="hm-fd">{t('home.how.step02body')}</span>
            </div>
          </div>
          <div className="hm-join" aria-hidden="true">
            <svg viewBox="0 0 44 32"><g style={{stroke:'currentColor', fill:'none', strokeWidth:1.4, strokeLinecap:'round', strokeLinejoin:'round'}}><path d="M2 16 H38 M34 11 L40 16 L34 21"/></g></svg>
          </div>
          <div className="hm-fstage">
            <span className="hm-fstep"><b>03</b>{t('home.how.step03')}</span>
            <div className="hm-fres" aria-hidden="true">
              <div className="hm-rrow hm-top"><span>01</span><span className="hm-bar"><i style={{ width: '96%' }} /></span></div>
              <div className="hm-rrow"><span>02</span><span className="hm-bar"><i style={{ width: '82%' }} /></span></div>
              <div className="hm-rrow"><span>03</span><span className="hm-bar"><i style={{ width: '71%' }} /></span></div>
            </div>
            <span className="hm-fsub">{t('home.how.step03sub')}</span>
            <div className="hm-fopt">
              <span className="hm-fstep" style={{ fontSize: '0.65625rem' }}>
                <b>04</b>{t('home.how.step04')}
                <span className="hm-opt">{t('home.how.step04opt')}</span>
              </span>
              <span className="hm-fsub">{t('home.how.step04sub')}</span>
            </div>
          </div>
        </div>
        <div className="hm-ws-cta">
          <a className="hm-cta-p" href={BASE_BETA_URL}>{t('home.how.tryCta')}</a>
          <span className="hm-lbl-dim">{t('home.how.note')}</span>
        </div>
      </div>
    </section>
  );
}
