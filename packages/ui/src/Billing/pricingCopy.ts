import type { BillingPlanLimits } from "@resomix/api-client";

/**
 * Every literal string on the consumer pricing surface lives here so copy review has one file.
 * Numeric prices, dates and limits are never stored here — those come from the billing API.
 *
 * Replaced (house rules): the retired Pro tagline that claimed preferential processing, and the
 * Free tagline that implied permanence. See FREE_CARD.tagline / PRO_CARD.tagline below.
 */

/**
 * Launch gates. Flip `PAID_CHECKOUT.enabled` to `true` when paid checkout goes live —
 * the notice, disabled CTA state, and consent checkbox all read that single flag so one
 * flip produces a clean page with no residue. (Formerly `PAID_CHECKOUT_ENABLED`.)
 */
export const PAID_CHECKOUT = {
  // ON: the Alwyzon billing endpoints (/billing/checkout, /portal, /plans, /subscription) are live
  // and the Stripe Pro price ids are configured, so the Pro CTA opens real Stripe Checkout.
  // Set back to false to take purchasing down without touching any other code.
  enabled: true,
  disabledReason: "Checkout is temporarily unavailable. Free and Guest access are unaffected.",
};

export const PAID_CHECKOUT_DISABLED_REASON = PAID_CHECKOUT.disabledReason;

/**
 * Sample Full Track Intelligence band. Off until an approved demonstration track exists —
 * linking to an empty `/analysis` is worse than no button. Flip `.enabled` when a demo track ships.
 */
export const SAMPLE_REPORT = {
  enabled: false,
};

export const PAGE = {
  backHome: "Back to home",
  // The page H1. "Pricing" alone is a weak heading for what is now the indexable pricing page,
  // and it fell under the 10-character floor prerenderedBody.spec asserts for a readable H1.
  title: "Plans and pricing",
  titleAccent: null as string | null,
  /** `topSkMax` is Pro `limits.top_sk_max` from the billing API — never hardcode the match count. */
  subtitle: (topSkMax: number) =>
    `Start free. Go Pro for uninterrupted discovery, up to ${topSkMax} matches per search and Full Track Intelligence.`,
  pricesUnavailable:
    "Prices are temporarily unavailable. Nothing has been charged, and Free and Guest access are unaffected. Please try again shortly.",
  loading: "Loading…",
} as const;

export const INTERVAL = {
  groupLabel: "Billing interval",
  monthly: "Monthly",
  yearly: "Yearly",
  saveAnnually: (pct: number) => `Save ${pct}% annually`,
} as const;

export const FREE_CARD = {
  tagline: "For everyone with an account",
  note: "No card required",
  listHeading: "What you get",
  ctaStart: "Start free",
  ctaCurrent: "Your plan",
  ctaIncluded: "Included",
} as const;

export const PRO_CARD = {
  tagline: "For everyday digging and production",
  listHeading: "Everything in Free, plus",
  flagFounding: "Founding offer",
  flagYourPlan: "Your plan",
  vatNote: "+ applicable VAT",
  /** Second sentence wherever the offer deadline appears — verbatim. */
  deadlineNotBetaEnd: "The offer deadline is not the end of the Resomix beta.",
  foundingAvailableUntil: (date: string) => `Founding offer available until ${date}.`,
  ctaChoose: "Choose Pro",
  ctaUpgrade: "Upgrade to Pro",
  ctaManage: "Manage billing",
  ctaBusyCheckout: "Redirecting…",
  ctaBusyPortal: "Opening…",
  activeUntil: (date: string) => `Pro active until ${date}`,
} as const;

export const CARDS = {
  seeComparison: "See the full comparison",
  footnotePrefix:
    "Prices exclude VAT; the exact total including applicable VAT is shown at checkout based on your billing location. Pro renews automatically at the selected interval until cancelled — cancel anytime and keep Pro until the end of the period you paid for.",
  footnoteFaqLink: "How the founding offer works",
} as const;

export const GUEST_RAIL = {
  label: "No account yet?",
  body:
    "Run Sonic Discovery as a guest — three searches a day with the top 10 matches visible. Guest playlists are public by default; an account makes them private.",
  cta: "Try Sonic Discovery",
} as const;

export const SEE_PRO = {
  label: "Before you decide",
  heading: "Look at a full Track Intelligence report.",
  body:
    "Free keeps the complete summary — BPM, key, energy, structure and the written read-outs. Pro opens the full dashboard underneath it. Open one and decide for yourself.",
  cta: "Open a full report",
} as const;

/** Quiet partner signpost — not a price list. Verbatim from the approved preview. */
export const PARTNER_BANNER = {
  label: "Not a consumer plan",
  heading: "Working with a catalogue, platform, or music product?",
  body:
    "Catalogue processing, partner API access, and guided pilots are scoped through a separate agreement.",
  cta: "Request a guided pilot",
} as const;

/** Compact closing consumer CTA — sits between FAQ legal links and the partner banner. */
export const CLOSING_CTA = {
  choosePro: "Choose Pro",
  startFree: "Start free instead",
  renewLine:
    "Renews automatically until cancelled — cancel anytime and keep Pro until the end of the period you paid for.",
} as const;

export const COMPARE = {
  heading: "Compare every plan",
  subtitle: "Guest is a way to try Sonic Discovery without signing up, not a plan you can buy.",
  featLabel: "Compare",
  /** Mobile only — substitutes Guest for Free in the two-column table. */
  switchLabel: "Compare",
  switchFreePro: "Free · Pro",
  switchGuestPro: "Guest · Pro",
  guestName: "Guest",
  guestPrice: "No account",
  freeName: "Free",
  proName: "Pro",
  groups: {
    discovery: "Discovery",
    trackIntelligence: "Track Intelligence",
    library: "Library",
    export: "Export",
    account: "Account and billing",
  },
  rows: {
    sonicSearches: "Sonic searches",
    matchesVisible: "Matches visible in a result",
    maxDepth: "Maximum search depth you can request",
    repeatSearch: "Repeat search of the same reference within 24 hours",
    openPlayShare: "Open, play and share a playlist by link",
    trackUploads: "Track uploads",
    completeSummary: "Complete analysis summary",
    similarityFromUpload: "Similarity playlist from your upload",
    fullDashboard: "Full Track Intelligence dashboard",
    playlistsListed: "Playlists listed in your Library",
    playlistsCreate: "Playlists you can create",
    newPlaylistsAre: "New playlists are",
    renameFavourite: "Rename, favourite and rate",
    customCover: "Custom playlist cover",
    exports: "Exports",
    tracksPerExport: "Tracks per export",
    txtTracklist: "TXT tracklist",
    appleMusic: "Apple Music transfer",
    playlistEmbed: "Playlist Embed",
    accountRequired: "Account required",
    price: "Price",
    cancelAnytime: "Cancel anytime, keep Pro to period end",
    billingPortal: "Billing portal — card, invoices, cancellation",
  },
  values: {
    freeRepeat: "Free",
    notCapped: "Not capped",
    public: "Public",
    private: "Private",
    noLibrary: "No Library",
    freePrice: "€0",
    na: "—",
    on: "on",
  },
} as const;

export const FAQ = {
  heading: "Frequently asked questions",
  tabs: {
    plans: "Plans and usage",
    billing: "Billing and payments",
    managing: "Managing your plan",
  },
  tablistLabel: "Question categories",
} as const;

export const FAQ_ITEMS = {
  unlimited: {
    q: "What does “Unlimited (fair use)” mean?",
    a: `Pro searches, exports, and Library listing have no plan-level numerical ceiling for normal individual use. Automated bulk submission through the consumer interface, sharing or transferring account credentials or API keys, and attempts to circumvent quotas or metering are not permitted. Bulk processing is available only under an applicable plan or written agreement.`,
  },
  allowances: {
    q: "When do my allowances reset?",
    a: `Searches and exports reset daily. Uploads reset monthly, on your own billing anniversary rather than on the first of the month — so two subscribers who joined on different days reset on different days. The reset time is shown in your local time.`,
  },
  library: {
    q: "What happens to my playlists if I pass the Free Library listing limit?",
    a: `Nothing is deleted. Free lists your five most recent playlists in the Library; beyond that a playlist is still created, saved and fully usable by its link — you can open, play, rename, export and share it. The Library header shows the full count so the number never looks like work went missing. Pro lists all of them.`,
  },
  freeSummary: {
    q: "What is in the Free analysis summary?",
    a: `The complete card, not a teaser: BPM with confidence, key, scale and Camelot code, duration, loudness, the energy journey, the section map, genre and style, danceability, valence, arousal, vocal or instrumental, the written read-outs for DJs, producers and curators, and a link to the matching similarity playlist.`,
  },
  fullTi: {
    q: "What does Full Track Intelligence add?",
    a: `Spectrograms, chromagram and tuning detail, beat, downbeat and phrase grids, spectral curves including centroid, rolloff, flatness, bandwidth and zero crossing, loudness and RMS energy across the whole recording, genre, mood and instrumentation over time, stem composition and vocal regions, and onset detection.`,
  },
  cancel: {
    q: "What happens if I cancel?",
    a: `Pro remains active until the end of the period you have already paid for, then the account returns to Free. Your playlists and analyses stay; Free listing and visibility limits apply again. Cancellation is handled in the billing portal.`,
  },
  vat: {
    q: "How is VAT handled?",
    a: `Displayed prices are base amounts excluding VAT. The exact total including applicable VAT is calculated from your billing location and shown at checkout before you are bound to pay.`,
  },
  uploads: {
    q: "What happens to audio I upload?",
    a: `Temporary Reference Uploads are processed privately, are not made public or accessible to other users, and are deleted no later than 24 hours after upload or analysis. User audio is not used to train or fine-tune PYXIS-1.`,
  },
  appleMusic: {
    q: "Do I need Apple Music to use the transfer?",
    a: `Yes — the Apple Music destination transfers a playlist into your own Apple Music account, so it requires one. The TXT tracklist needs nothing. Resomix is not an Apple partner and Apple Music is not a source of analysis.`,
  },
  foundingOffer: {
    q: "When does the founding offer close, and what happens to my price?",
  },
} as const;

export const LEGAL_LINKS: ReadonlyArray<{ label: string; slug: string }> = [
  { label: "Terms of Service", slug: "terms" },
  { label: "Privacy Policy", slug: "privacy" },
  { label: "Refund Policy", slug: "refunds" },
  { label: "Acceptable Use Policy", slug: "acceptable-use" },
  { label: "Platform Disclaimer", slug: "platform-disclaimer" },
  { label: "Copyright & DMCA", slug: "copyright-dmca" },
  { label: "Cookie Policy", slug: "cookies" },
];

export const LEGAL_BASE = "https://legal.resomix.com/legal";

export const CONSENT =
  "I want my subscription to start immediately. I understand that once it does, I lose my 14-day right of withdrawal for the part already provided.";

export const ERRORS = {
  needConsent: "Please confirm the statement below before subscribing.",
  checkoutFailed: "Couldn't start checkout. Please try again.",
  portalFailed: "Couldn't open the billing portal.",
} as const;

/**
 * Guest has no plan row in `/billing/plans` today.
 * TODO(guest-limits): replace with the API row — see docs/page-demos/subscribe/CURSOR_MASTER_PROMPT.md §4.4
 */
export const GUEST_LIMITS_FALLBACK: BillingPlanLimits = {
  searches_per_day: 3,
  uploads_per_month: 0,
  top_sk_max: 10,
  dropdown_max_tracks: 20,
  library_playlists_max: 0,
  exports_per_day: 0,
  export_track_limit: 0,
  can_view_full_analysis: false,
  can_similarity_upload: false,
};
