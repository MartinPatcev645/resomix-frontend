import { useTranslation } from 'react-i18next';
import { CI_RESULT_ROWS } from './ciData.ts';

type CiResultListProps = {
  /** 'flow' is used inside the S3 aside — the parent `.ci-flowlist` class
   * hides the catalogue-id column at narrower widths, matching the preview. */
  variant?: 'default' | 'flow';
};

/* Shared ranked-result table — the real product output the lattice figures
   resolve into. Geometry-free (plain markup), transplanted verbatim from the
   preview's `.rlist` structure. Reused by S2 (product) and S3 (flow). */
export function CiResultList({ variant = 'default' }: CiResultListProps) {
  const { t } = useTranslation('common');

  return (
    <div className={`ci-rlist${variant === 'flow' ? ' ci-rlist-flow' : ''}`}>
      <div className="ci-rhead">
        <span>{t('catalogueIntelligence.results.headRank')}</span>
        <span>{t('catalogueIntelligence.results.headRecording')}</span>
        <span>{t('catalogueIntelligence.results.headId')}</span>
        <span>{t('catalogueIntelligence.results.headSimilarity')}</span>
        <span aria-hidden="true" />
      </div>
      {CI_RESULT_ROWS.map((row, index) => (
        <div
          key={row.id}
          className={`ci-rrow${row.top ? ' ci-top' : ''} ci-resolve d${index + 1}`}
        >
          <span className="ci-rk">{row.rank}</span>
          <span className="ci-ti">{row.title}</span>
          <span className="ci-id">{row.id}</span>
          <span className="ci-sc">{row.score}</span>
          <span className="ci-au" aria-label={t('catalogueIntelligence.results.audition')}>
            ▸
          </span>
        </div>
      ))}
    </div>
  );
}
