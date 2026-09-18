/**
 * Pricing questions and answers, and the order each category shows them in.
 *
 * Deliberately in a file of its own with NO imports. Two very different readers need these strings.
 * `PricingFaq` renders them in both apps, and the landing build imports this file directly from
 * `vite.config.ts` to emit the page's `FAQPage` structured data from the very text the page shows.
 * The config is type-checked as part of the landing app, where the billing package's types resolve
 * differently, so anything it reads has to stand on its own. `pricingCopy.ts` re-exports all three
 * names, so nothing else needs to know this file exists.
 */
export const FAQ = {
  heading: "Frequently asked questions",
  tabs: {
    plans: "Plans and usage",
    billing: "Billing and payments",
    managing: "Managing your plan",
  },
} as const;

export const FAQ_ITEMS = {
  /*
   * The first three are written for the words people type into a search engine or an AI assistant,
   * which is what the September 2026 ShelfSignal report found we never answered in plain language.
   * They name the brand on purpose, because an assistant quoting an answer has to carry it.
   */
  isFree: {
    q: "Is Resomix free?",
    a: `Yes. Resomix is free to use with an account, and no card is required. Sonic Discovery and the complete analysis summary are included, and you can run three searches a day as a guest without signing up at all. Pro is for people who want uninterrupted discovery, more matches in each result and the full Track Intelligence dashboard.`,
  },
  tryFirst: {
    q: "Do I need a paid plan to try Resomix?",
    a: `No. Start as a guest or on the free Resomix plan, run a real search on your own reference and read the analysis summary before you decide anything. There is no card to enter, and the free plan is not a timed trial.`,
  },
  /*
   * The price is stated with its date attached. Everywhere else on this surface the number comes
   * from the billing API, and this is the one place a figure is written by hand, so it is dated
   * rather than left to go quietly stale after the next price change.
   */
  proPrice: {
    q: "How much does Resomix Pro cost?",
    a: `As of late 2026, Resomix Pro is €7.99 per month plus applicable VAT, with a saving on annual billing. Prices change over time, so treat that figure as a guide. What applies to you is what the plan cards above show and what the checkout confirms before you pay.`,
  },
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

/**
 * The static questions each category shows, in the order the page renders them.
 *
 * Two readers depend on this. `PricingFaq` builds its three category lists from it, and the landing
 * build reads it to emit the page's `FAQPage` structured data from the very strings the page shows.
 * Keeping one list means the markup can never describe a question a visitor cannot see.
 *
 * `foundingOffer` is deliberately absent. Its answer is assembled at runtime from the billing API,
 * so there is no fixed text to declare, and `PricingFaq` prepends it to the billing list itself
 * whenever the offer is open.
 */
export const FAQ_ORDER = {
  plans: [
    "isFree",
    "tryFirst",
    "unlimited",
    "allowances",
    "library",
    "freeSummary",
    "fullTi",
    "appleMusic",
  ],
  billing: ["proPrice", "vat"],
  managing: ["cancel", "uploads"],
} as const satisfies Record<string, ReadonlyArray<keyof typeof FAQ_ITEMS>>;

/** Every question whose answer is fixed copy. `foundingOffer` is built from live billing data. */
export type StaticFaqId = Exclude<keyof typeof FAQ_ITEMS, "foundingOffer">;
