import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { TrStatusChip } from './TrStatusChip.tsx';
import { LEGAL_EMAIL, RIGHTS_QA } from './trData.ts';

export function TrRightsQA() {
  const { t } = useTranslation('common');

  return (
    <section id="rights" aria-label="Rights, access and catalogue boundaries" className="tr-section">
      <header className="tr-dim-intro">
        <p className="tr-eyebrow uppercase">{t('trust.rights.eyebrow')}</p>
        <h2 className="tr-h2b uppercase">{t('trust.rights.title')}</h2>
      </header>
      <dl className="tr-qa">
        {RIGHTS_QA.map((item) => (
          <Fragment key={item.id}>
            <dt>{t(item.questionKey)}</dt>
            <dd>
              {item.answerKey ? (
                <>
                  {t(item.answerKey)}
                  {item.status ? (
                    <>
                      {' '}
                      <TrStatusChip status={item.status} />
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {t(item.answerBeforeKey!)}
                  <a className="tr-bracket" href={`mailto:${LEGAL_EMAIL}`}>
                    {LEGAL_EMAIL}
                  </a>
                  {t(item.answerAfterKey!)}
                </>
              )}
            </dd>
          </Fragment>
        ))}
      </dl>
      <div className="tr-note tr-note-boundary">
        <b>{t('trust.rights.boundaryBold')}</b>
        {t('trust.rights.boundaryRest')}
      </div>
    </section>
  );
}
