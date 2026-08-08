type SilktideWindow = Window & {
  silktideConsentManager?: {
    getInstance?: () => {
      icon?: HTMLElement;
    } | null;
  };
};

function getSilktideManager() {
  // Guarded for the server: these helpers are called during render (NavMenuContent's cookie-settings
  // row, MobileDrawer's lazy useState), and the marketing pages are prerendered in Node at build
  // time. An unguarded `window` here threw inside React's renderer, which abandoned the whole tree
  // and shipped every route with an empty <div id="root"> — a silent, total loss of crawlable HTML.
  if (typeof window === "undefined") return undefined;
  return (window as SilktideWindow).silktideConsentManager;
}

export function openCookiePreferences(): boolean {
  const manager = getSilktideManager()?.getInstance?.();
  if (manager?.icon) {
    manager.icon.click();
    return true;
  }
  return false;
}

export function isCookiePreferencesAvailable(): boolean {
  return Boolean(getSilktideManager()?.getInstance?.()?.icon);
}
