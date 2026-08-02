/** Fictional demonstration rows — titles, artists and scores verbatim from the preview. */
export type PoPlaylistRow = {
  rank: string;
  title: string;
  artist: string;
  score: string;
  top?: boolean;
};

export const PO_PLAYLIST_ROWS: PoPlaylistRow[] = [
  { rank: '01', title: 'Night Transit', artist: 'Kessler Line', score: '93.1%', top: true },
  { rank: '02', title: 'Glass Harbour', artist: 'Mira Volt', score: '92.4%' },
  { rank: '03', title: 'Low Altitude', artist: 'Oster Fen', score: '91.8%' },
  { rank: '04', title: 'Still Current', artist: 'Duna Praxis', score: '91.2%' },
  { rank: '05', title: 'Pale Meridian', artist: 'Nadir Club', score: '90.9%' },
];

export const PO_CAT_RESULTS = [
  { rank: '01', id: 'CAT-0417', score: '93.1%', top: true },
  { rank: '02', id: 'CAT-1121', score: '92.4%' },
  { rank: '03', id: 'CAT-0088', score: '91.8%' },
  { rank: '04', id: 'REC-1C44', score: '91.2%' },
  { rank: '05', id: 'CAT-1388', score: '90.9%' },
] as const;

export const PO_DEMO_TRACK = 'STILL CURRENT · REC-2A91';
