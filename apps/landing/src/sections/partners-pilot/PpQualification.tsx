import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

/** Blog destination per qualification row, from the interlinking map. Only row 0 is mapped. */
const MATRIX_BLOG: Record<number, string> = { 0: BLOG.backCatalogue };

export function PpQualification() {
  const { t } = useTranslation('common');
  const [fitOpen, setFitOpen] = useState(false);

  const matrixRows = t('partnersPilot.qualification.matrix', {
    returnObjects: true,
  }) as { type: string; question: string }[];

  const strongFit = t('partnersPilot.qualification.strongFit', {
    returnObjects: true,
  }) as string[];

  const needsScoping = t('partnersPilot.qualification.needsScoping', {
    returnObjects: true,
  }) as string[];

  return (
    <section id="fit" aria-label="Who the pilot is for" className="pp-section">
      <header className="pp-dim-intro">
        <p className="pp-eyebrow uppercase">{t('partnersPilot.qualification.eyebrow')}</p>
        <h2 className="pp-h2b uppercase">{t('partnersPilot.qualification.title')}</h2>
      </header>
      <div className="pp-qmx">
        {matrixRows.map((row, i) => (
          <div key={row.type} className="pp-qrow">
            <span className="pp-qrow-t uppercase">{row.type}</span>
            <p>
              {/* MB-31 sits on the first row. Keyed by index so the anchor stays inside the
                  translated question rather than being appended as a separate element. */}
              <Trans
                i18nKey={`partnersPilot.qualification.matrix.${i}.question`}
                components={{ a: <a className="rx-copylink" target="_blank" rel="noopener" href={MATRIX_BLOG[i] ?? ''} /> }}
              />
            </p>
          </div>
        ))}
      </div>
      <p className="pp-interp">
        <b>{t('partnersPilot.qualification.interpBold')}</b>{' '}
        {t('partnersPilot.qualification.interpBody')}
      </p>
      <button
        type="button"
        className="pp-ghostbtn pp-m-fitbtn uppercase"
        aria-expanded={fitOpen}
        aria-controls="pp-fitgrid"
        onClick={() => setFitOpen((o) => !o)}
      >
        {fitOpen
          ? t('partnersPilot.qualification.fitBtnOpen')
          : t('partnersPilot.qualification.fitBtnClosed')}
      </button>
      <div className={`pp-fitgrid${fitOpen ? ' pp-open' : ''}`} id="pp-fitgrid">
        <div className="pp-fitcol">
          <span className="pp-hudlbl uppercase">
            {t('partnersPilot.qualification.strongFitLabel')}
          </span>
          <ul>
            {strongFit.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="pp-fitcol">
          <span className="pp-hudlbl uppercase">
            {t('partnersPilot.qualification.needsScopingLabel')}
          </span>
          <ul>
            {needsScoping.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
