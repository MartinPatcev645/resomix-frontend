import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/* S7 · Publisher knowledge remains central. */
export function MpClosing() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="mp-closing mp-section" id="mp-s7">
      <div className="mp-wrap">
        <div className="mp-eyebrow">{t('musicPublishers.closing.eyebrow')}</div>
        <div className="mp-copycol">
          <p className="mp-body-p">{t('musicPublishers.closing.p1')}</p>
          <p className="mp-body-p">{t('musicPublishers.closing.p2')}</p>
        </div>

        <div className="mp-triad">
          <div className="mp-plate mp-knowledge mp-chamfer">
            <div className="mp-t">{t('musicPublishers.closing.triad.knowledgeTitle')}</div>
            <div className="mp-s">{t('musicPublishers.closing.triad.knowledgeSub')}</div>
          </div>
          <div className="mp-op" aria-hidden="true">
            +
          </div>
          <div className="mp-plate mp-chamfer">
            <div className="mp-t">{t('musicPublishers.closing.triad.evidenceTitle')}</div>
            <div className="mp-s">{t('musicPublishers.closing.triad.evidenceSub')}</div>
          </div>
          <div className="mp-op" aria-hidden="true">
            →
          </div>
          <div className="mp-plate mp-chamfer">
            <div className="mp-t">{t('musicPublishers.closing.triad.decisionsTitle')}</div>
            <div className="mp-s">{t('musicPublishers.closing.triad.decisionsSub')}</div>
          </div>
        </div>

        <p className="mp-close-line">{t('musicPublishers.closing.closeLine')}</p>

        <div className="mp-cta-row mp-close-ctas">
          <button
            type="button"
            className="mp-btn mp-primary"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('musicPublishers.cta.pilot')}
          </button>
          <button
            type="button"
            className="mp-btn"
            onClick={() => navigate('/product/catalog-intelligence')}
          >
            {t('musicPublishers.cta.exploreCi')}
          </button>
          <span className="mp-cta-status">{t('musicPublishers.closing.status')}</span>
        </div>
      </div>
    </section>
  );
}
