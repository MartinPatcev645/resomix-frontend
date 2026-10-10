/**
 * Hardcoded Bandcamp copy — webapp convention (no i18n), as in `navCopy.ts`.
 */

export const BANDCAMP_COPY = {
  kicker: "Account // Library",
  title: "Bandcamp collection",
  intro: "Import your public Bandcamp fan collection and explore it by sound.",

  connect: {
    label: "Bandcamp username",
    placeholder: "yourname or bandcamp.com/yourname",
    hint: "Paste your fan page link or type the username from bandcamp.com/yourname.",
    note:
      "Only public collections can be imported. We only read your public collection; we never ask for your Bandcamp password.",
    submit: "Connect",
    submitting: "Connecting…",
  },

  parse: {
    empty: "Enter your Bandcamp username.",
    artist_url: "That looks like an artist page. Enter your fan username (bandcamp.com/yourname) instead.",
    invalid: "That doesn't look like a Bandcamp username. Use the name from bandcamp.com/yourname.",
  },

  errors: {
    not_found: {
      title: "User not found",
      body: "We couldn't find that Bandcamp user.",
    },
    private: {
      title: "This collection is private",
      body: "We can only import collections that are public. To make yours public:",
      steps: [
        "Sign in to Bandcamp and open your fan page.",
        "Go to Settings, then Fan.",
        "Turn off the option that hides your collection, then save.",
        "Come back here and try again.",
      ],
    },
    invalid: {
      title: "Not a fan username",
      body: "Enter a fan username, not an artist page.",
    },
    rate_limited: {
      title: "Too many requests",
      body: "Too many requests, try again in a minute.",
    },
    network: {
      title: "Connection problem",
      body: "We couldn't reach Resomix. Check your connection and try again.",
    },
    auth: {
      title: "Session expired",
      body: "Your session has expired. Sign in again to continue.",
    },
    unknown: {
      title: "Something went wrong",
      body: "Something went wrong on our side. Please try again.",
    },
  },

  sync: {
    title: "Importing your collection",
    progressKnown: (processed: number, total: number) => `Imported ${processed} / ${total}`,
    progressUnknown: "Importing your collection…",
    pending: "Waiting to start…",
    keepOpen: "You can leave this page; the import keeps running.",
    failedTitle: "Import failed",
    failedFallback: "The import stopped before it finished.",
    retry: "Retry",
  },

  collection: {
    heading: "Your collection",
    pagesLabel: "Collection pages",
    searchLabel: "Search your collection",
    searchPlaceholder: "Artist, title or album",
    count: (total: number) => (total === 1 ? "1 item" : `${total} items`),
    noResults: (q: string) => `Nothing in your collection matches "${q}".`,
    clearSearch: "Clear search",
    empty: "This collection is empty or has no public items.",
    refresh: "Refresh",
    connectedAs: (username: string) => `Connected as ${username}`,
    album: "Album",
    track: "Track",
    fromAlbum: (album: string) => `From ${album}`,
    openOnBandcamp: "Bandcamp",
    openOnBandcampLabel: (title: string) => `Open ${title} on Bandcamp (opens in a new tab)`,
    artworkAlt: (title: string, artist: string) => `${title} by ${artist}`,
    prev: "Prev",
    next: "Next",
    page: (page: number, totalPages: number) => `Page ${page} of ${totalPages}`,
  },

  status: {
    inResomix: "In Resomix",
    notInResomix: "Not in Resomix yet",
    pending: "Analysis pending",
    done: "Analyzed",
    failed: "Analysis failed",
  },

  actions: {
    findSimilar: "Find similar",
    analyze: "Analyze",
    albumDisabled: "Albums can't be analyzed yet.",
    unmatchedDisabled: "This track isn't in Resomix yet.",
    analyzeComingSoon: "Track Intelligence for imported tracks is coming soon.",
  },

  disconnect: {
    button: "Disconnect",
    title: "Disconnect Bandcamp?",
    message: "This removes your imported Bandcamp collection from Resomix. Your Bandcamp account is not affected.",
    confirm: "Disconnect",
    busy: "Disconnecting…",
    failed: "We couldn't disconnect right now. Please try again.",
  },

  links: {
    library: "Back to Library",
    importFromBandcamp: "Import from Bandcamp",
  },
} as const;
