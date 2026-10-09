/**
 * GTM dataLayer pushes for the analytics identity events.
 *
 * PostHog is not initialised by this codebase at all: the GTM container (GTM-PD9XQZRV) loads it,
 * so the only way to tell PostHog who a visitor is, is to put the identity on the dataLayer and let
 * a GTM tag call `posthog.identify()` / `posthog.reset()` with it.
 *
 * Pushing before GTM has loaded is safe and deliberate. `useGoogleTagManager` defers the container
 * by 4 s (and consent may delay it further), and GTM replays whatever is already in the array when
 * it starts, so an event fired at login still reaches PostHog.
 *
 * The id is the backend `user.uuid`, never the email: an email is personal data and can change,
 * a uuid cannot.
 */

type DataLayerEvent = Record<string, unknown>;

function push(event: DataLayerEvent): void {
  // The landing app prerenders on the server (entry-server.tsx), where `window` does not exist.
  if (typeof window === 'undefined') return;
  const w = window as unknown as { dataLayer?: DataLayerEvent[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(event);
}

/**
 * The uuid this page load has already announced. Identity is pushed from an effect that re-runs on
 * every auth change (token refresh, profile hydration, cross-tab sync), and without this a single
 * session would emit `user_identified` repeatedly.
 */
let identifiedUserId: string | null = null;

/** Fired on login and on any page load that restores an authenticated session. Once per user. */
export function pushUserIdentified(userId: string): void {
  if (!userId || identifiedUserId === userId) return;
  // An identity can change WITHOUT a logout in between: `reconcileIdentityIfMismatch` in
  // useAuthInit adopts the server's user when a shared *.resomix.com refresh cookie belongs to
  // someone else than this origin's persisted user. Announce the end of the previous identity
  // first, so the GTM tag can reset PostHog before identifying the new person; identifying
  // straight over the top would alias two real users into one.
  if (identifiedUserId) pushUserLogout();
  identifiedUserId = userId;
  push({ event: 'user_identified', user_id: userId });
}

/**
 * Fired when a session ends, whether the user clicked log out or the server invalidated it.
 * A no-op when nobody was identified, so a guest browsing the marketing site emits nothing.
 */
export function pushUserLogout(): void {
  if (!identifiedUserId) return;
  identifiedUserId = null;
  push({ event: 'user_logout' });
}

/**
 * Fired once, immediately after the account is created. Email signup does not log the user in (they
 * verify by email first), so this carries the uuid from the registration response rather than from
 * the auth store.
 */
export function pushSignupCompleted(params: {
  userId?: string | null;
  signupSource: 'email' | 'google';
  surface?: string;
}): void {
  const event: DataLayerEvent = {
    event: 'signup_completed',
    signup_source: params.signupSource,
    surface: params.surface ?? 'register',
    user_status: 'free',
  };
  if (params.userId) event.user_id = params.userId;
  push(event);
}

/**
 * Fired when someone opens a download-store link from a track ("GET IT // ..." or the cart menu).
 * GTM forwards it to PostHog as `store_link_clicked` (George, October 2026). `row_state` says
 * whether the track's player was open (they buy while listening) or closed (while scrolling);
 * `surface` says where on the page: a result row, the sticky reference bar or the reference card.
 */
export function pushStoreLinkClicked(params: {
  store: 'traxsource' | 'bandcamp';
  rowState: 'open' | 'closed';
  surface: 'row' | 'sticky' | 'hero';
  trackId?: string | null;
}): void {
  const event: DataLayerEvent = {
    event: 'store_link_clicked',
    store: params.store,
    row_state: params.rowState,
    surface: params.surface,
  };
  if (params.trackId) event.track_id = params.trackId;
  push(event);
}
