type SilktideWindow = Window & {
  silktideConsentManager?: {
    getInstance?: () => {
      icon?: HTMLElement;
    } | null;
  };
};

function getSilktideManager() {
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
