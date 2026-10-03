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
  /**
   * Optional contextual blog link for this capability, from the interlinking map (MB-29).
   *
   * It is rendered only in the open rail list, never in the SVG figure: `items` is drawn into
   * `<text>` nodes, where an anchor would be invalid, and the same two strings feed both. Keeping
   * the link in its own field is what lets the list carry it while the figure stays plain.
   */
  blog?: { label: string; href: string };
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
    blog: {
      label: 'How a back catalogue becomes revenue',
      href: 'https://blog.resomix.com/how-your-labels-back-catalogue-becomes-a-reliable-revenue-stream/',
    },
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
