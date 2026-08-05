export type RouteId = 'pilot' | 'api' | 'integration';

export type AudienceId = 'label' | 'dist' | 'store' | 'cat' | 'tech';

export const ROUTE_IDS: RouteId[] = ['pilot', 'api', 'integration'];

export const ROUTE_Y: Record<RouteId, number> = {
  pilot: 70,
  api: 150,
  integration: 230,
};

export const ROUTE_DEST: Record<RouteId, string> = {
  pilot: '/partners/pilot',
  api: '/developers',
  integration: '#contact',
};

export const ROUTE_NAMES: Record<RouteId, string> = {
  pilot: '01 · PRIVATE PILOT',
  api: '02 · API + INGESTION',
  integration: '03 · INTEGRATION PLANNING',
};

export const AUDIENCE_IDS: AudienceId[] = ['label', 'dist', 'store', 'cat', 'tech'];

export const AUDIENCE_ROUTES: Record<AudienceId, RouteId[]> = {
  label: ['pilot'],
  dist: ['pilot', 'api'],
  store: ['api'],
  cat: ['pilot'],
  tech: ['api', 'integration'],
};

export interface EngagementStage {
  t: string;
  you: string;
  rx: string;
  next: string;
}

export const ENGAGEMENT_STAGES: EngagementStage[] = [
  {
    t: 'FIT',
    you: 'The catalogue, the product context and the question you need answered.',
    rx: 'Whether a pilot, API onboarding or integration scoping fits the question.',
    next: 'A recommended route, with the reasoning.',
  },
  {
    t: 'ROUTE',
    you: 'Constraints: timing, rights position and available teams.',
    rx: 'The right path and its prerequisites.',
    next: 'A scoping agenda for that path.',
  },
  {
    t: 'SCOPE',
    you: 'Material, reviewers and success criteria for the chosen path.',
    rx: 'Method, responsibilities and the evaluation or implementation design.',
    next: 'An agreed scope; nothing starts before approval.',
  },
  {
    t: 'PROCEED',
    you: 'The approved sample or integration access.',
    rx: 'Operational kickoff on the agreed path.',
    next: 'The pilot protocol or onboarding begins.',
  },
];

export interface CapabilityBranch {
  id: string;
  t: string;
  items: [string, string];
  dest: string;
  y: number;
}

export const CAPABILITY_BRANCHES: CapabilityBranch[] = [
  {
    id: 'catalogue-intelligence',
    t: 'CATALOGUE INTELLIGENCE',
    items: [
      'analyse catalogue audio · build sonic relationships',
      'surface older + underexposed tracks · human review',
    ],
    dest: '/product/catalog-intelligence',
    y: 60,
  },
  {
    id: 'sonic-discovery',
    t: 'SONIC SIMILARITY',
    items: [
      'track ID or approved upload → ranked matches',
      'results stay inside your authorised catalogue',
    ],
    dest: '/product/sonic-discovery',
    y: 170,
  },
  {
    id: 'track-intelligence',
    t: 'TRACK ANALYSIS',
    items: [
      'structured rhythm · harmony · energy · timbre · structure',
      'versioned output for the agreed workflow',
    ],
    dest: '/product/track-intelligence',
    y: 280,
  },
];
