/** Fictional demonstration rows — titles and IDs verbatim from the preview. */
export type CiResultRow = {
  rank: string;
  title: string;
  id: string;
  score: string;
  top?: boolean;
};

export const CI_RESULT_ROWS: CiResultRow[] = [
  { rank: '01', title: 'Night Transit', id: 'CAT-00417', score: '93.1%', top: true },
  { rank: '02', title: 'Glass Harbour', id: 'CAT-02290', score: '92.4%' },
  { rank: '03', title: 'Low Altitude', id: 'REC-2A91', score: '91.8%' },
  { rank: '04', title: 'Still Current', id: 'CAT-01121', score: '91.2%' },
  { rank: '05', title: 'Pale Meridian', id: 'CAT-00088', score: '90.9%' },
];

export const CI_REF_ID = 'CAT-01842';
export const CI_DEMO_TRACK = 'Still Current';
export const CI_DEMO_TRACK_ID = 'CAT-01121';
