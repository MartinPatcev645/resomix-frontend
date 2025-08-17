import { useEffect, useState } from "react";

const COOKIE_NAME = "resomix_default";
const COOKIE_VALUE = "1";
const COOKIE_DOMAIN = ".resomix.com"; // applies to all sub-domains

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, domain?: string) {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/`;
  if (domain) cookie += `; domain=${domain}`;
  // Session cookie (no expiry)
  document.cookie = cookie;
}

/**
 * Hook to detect first visit across *.resomix.com and lazily set cookie.
 * Returns whether the welcome dialog should be shown and a handler to dismiss it.
 */
export function useFirstVisit() {
  // const [showWelcome, setShowWelcome] = useState(() => getCookie(COOKIE_NAME) === null);
  const [showWelcome, setShowWelcome] = useState(false); // Hardcoded to not show welcome message

  // useEffect(() => {
  //   if (showWelcome) {
  //     setCookie(COOKIE_NAME, COOKIE_VALUE, COOKIE_DOMAIN);
  //   }
  // }, [showWelcome]);

  const dismiss = () => setShowWelcome(false);

  return { showWelcome, dismiss } as const;
}
