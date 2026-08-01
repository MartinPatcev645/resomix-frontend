import { useTranslation } from 'react-i18next';

export function McuStatement() {
  const { t } = useTranslation('common');

  return (
    <section className="mcu-statement mcu-section" id="mcu-statement">
      <div className="mcu-frame">
        <h2 className="mcu-sr">{t('musicCurators.statement.srTitle')}</h2>
        <p className="mcu-body">{t('musicCurators.statement.p1')}</p>
        <p className="mcu-st">{t('musicCurators.statement.engine')}</p>
      </div>
    </section>
  );
}
