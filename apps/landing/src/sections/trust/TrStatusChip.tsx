import { useTranslation } from 'react-i18next';
import type { TrustStatusKey } from './trData.ts';

const STATUS_CLASS: Record<TrustStatusKey, string> = {
  current: 'tr-st-current',
  agreementBound: 'tr-st-agree',
  betaControl: 'tr-st-beta',
  roadmap: 'tr-st-road',
  notClaimed: 'tr-st-not',
  currentQualified: 'tr-st-current',
  currentLegalDisclosure: 'tr-st-current',
};

interface TrStatusChipProps {
  status: TrustStatusKey;
}

export function TrStatusChip({ status }: TrStatusChipProps) {
  const { t } = useTranslation('common');

  return (
    <span className={`tr-st uppercase ${STATUS_CLASS[status]}`}>
      {t(`trust.status.${status}`)}
    </span>
  );
}
