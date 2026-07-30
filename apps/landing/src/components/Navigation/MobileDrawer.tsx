import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@resomix/stores';
import {
  BETA_URL,
  NAV_TOP_GROUPS,
  NAV_UTILITY_LINKS,
  getNavSectionForPath,
} from './navData.ts';
import {
  NavPanelContent,
  CaretIcon,
  AccountIcon,
} from './NavMenuContent.tsx';
import { openCookiePreferences, isCookiePreferencesAvailable } from './cookiePreferences.ts';
import './navigation.css';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onProfileClick?: () => void;
  menuButtonId?: string;
}

export function MobileDrawer({
  isOpen,
  onClose,
  onNavigate,
  onProfileClick,
}: MobileDrawerProps) {
  const { t } = useTranslation('common');
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  /**
   * "There's more below" affordance. The drawer's content runs past the fold, and with no visible
   * scrollbar a first-time visitor can read the handful of visible rows as the whole menu. This
   * tracks whether the list is scrollable AND not yet at the end; the chevron only exists in that
   * window, and disappears once the bottom is reached.
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollCue, setShowScrollCue] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!isOpen || !el) return;

    const update = () => {
      const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
      setShowScrollCue(remaining > 24);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    // Accordions open/close and images settle, so the scroll height changes after mount. Guarded:
    // ResizeObserver is missing in jsdom and older browsers, and the cue must never break the menu.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) {
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
    }
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [isOpen]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const [cookieSettingsEnabled] = useState(isCookiePreferencesAvailable);
  const currentSection = getNavSectionForPath(location.pathname);
  /**
   * Signing in always happens on the WEBAPP, and lands you in the workspace afterwards.
   *
   * `redirect` is resolved by the webapp's AuthPage against ITS OWN routes, so it must be a webapp
   * path. This used to pass the current landing path, which sent you to
   * beta.resomix.com/<landing-route> after a successful sign-in — e.g. /partners, which does not
   * exist there. '/' is the workspace root. (Same fix as the desktop header.)
   */
  const loginHref = `${BETA_URL}/auth/login?redirect=${encodeURIComponent('/')}`;

  useLayoutEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const page = document.getElementById('landing-page-root');
    document.body.classList.add('nav-locked');
    if (page && 'inert' in page) {
      (page as HTMLElement).inert = true;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('nav-locked');
      if (page && 'inert' in page) {
        (page as HTMLElement).inert = false;
      }
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleLogout = useCallback(async () => {
    try {
      const { logout } = await import('@resomix/api-client');
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      useAuthStore.getState().logout();
      // Straight to beta's login rather than the local '/auth/login', which now only exists as a
      // redirect to exactly this URL — going through it would just add a hop and a loader frame.
      onNavigate(loginHref);
      onClose();
    }
  }, [onClose, onNavigate, loginHref]);

  const profileMenuItems = [
    {
      label: 'Profile',
      id: 'nav-drawer-profile-menu-item',
      href: `${BETA_URL}/profile`,
      icon: <AccountIcon />,
      onClick: () => {
        if (onProfileClick) onProfileClick();
        else onNavigate(`${BETA_URL}/profile`);
        onClose();
      },
    },
    {
      label: 'Logout',
      id: 'nav-drawer-logout-menu-item',
      separated: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full" aria-hidden="true">
          <path
            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      onClick: handleLogout,
    },
  ];

  const handleNavigate = (path: string) => {
    onNavigate(path);
    onClose();
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordion((prev) => (prev === key ? null : key));
  };

  const handleBackdropClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="nav-drawer is-open"
      id="nav-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={t('nav.drawerLabel')}
      onPointerDown={handleBackdropClick}
    >
      <div className="nav-drawer-panel">
        <div className="nav-drawer-top">
          <span className="nav-lbl">{t('nav.drawerTitle')}</span>
          <button
            type="button"
            className="nav-drawer-x"
            ref={closeRef}
            aria-label={t('nav.closeMenu')}
            onClick={onClose}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 2l12 12M14 2 2 14" />
            </svg>
          </button>
        </div>

        <div className="nav-drawer-scroll" ref={scrollRef}>
          {NAV_TOP_GROUPS.map((group) => {
            const expanded = openAccordion === group.key;
            const isSection = currentSection === group.key;
            return (
              <div className="nav-acc" key={group.key}>
                <button
                  type="button"
                  className="nav-acc-btn"
                  aria-expanded={expanded}
                  aria-controls={`acc-${group.key}`}
                  onClick={() => toggleAccordion(group.key)}
                >
                  {t(`nav.topGroups.${group.key}`)}
                  {isSection ? (
                    <span className="nav-sr">{t('nav.currentSection')}</span>
                  ) : null}
                  <CaretIcon />
                </button>
                <div className="nav-acc-body" id={`acc-${group.key}`}>
                  <NavPanelContent
                    group={group}
                    pathname={location.pathname}
                    hash={location.hash}
                    onNavigate={handleNavigate}
                    noteId={group.key === 'solutions' ? 'planned-note-m' : undefined}
                  />
                </div>
              </div>
            );
          })}

          <div className="nav-util">
            <p className="nav-mm-group">{t('nav.groups.resourcesCompany')}</p>
            <ul>
              {NAV_UTILITY_LINKS.map((link) => {
                if (link.isCookieSettings) {
                  return (
                    <li key={link.key}>
                      <button
                        type="button"
                        disabled={!cookieSettingsEnabled}
                        title={
                          cookieSettingsEnabled
                            ? undefined
                            : 'TODO(nav): Silktide programmatic open unavailable'
                        }
                        onClick={() => {
                          if (openCookiePreferences()) onClose();
                        }}
                      >
                        {t(`nav.utility.${link.key}`)}
                      </button>
                    </li>
                  );
                }
                const label = t(`nav.utility.${link.key}`);
                if (link.external) {
                  return (
                    <li key={link.key}>
                      <a
                        href={link.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.externalAriaKey ? t(`nav.${link.externalAriaKey}`) : undefined}
                        onClick={onClose}
                      >
                        {label}
                        <span className="nav-ext" aria-hidden="true">
                          ↗
                        </span>
                      </a>
                    </li>
                  );
                }
                return (
                  <li key={link.key}>
                    <a
                      href={link.route}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate(link.route);
                      }}
                    >
                      {label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="nav-drawer-cta">
            {/* Try Resomix is the drawer's one accent-filled action. */}
            <a
              className="nav-drawer-btn nav-drawer-btn--primary"
              href={BETA_URL}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = BETA_URL;
                onClose();
              }}
            >
              {t('nav.cta.tryResomix')}
            </a>
            <a
              className="nav-drawer-btn nav-drawer-btn--secondary"
              href="/partners/pilot"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('/partners/pilot');
              }}
            >
              {t('nav.cta.startPilot')}
            </a>
          </div>

          {/* Signed in: the account items laid out flat. A dropdown here would be a menu inside an
              already-open menu, and mobile has the room to just show them. Logout is accent-
              outlined — clearly the accent action, without competing with the primary above. */}
          {isAuthenticated ? (
            <div className="nav-drawer-account">
              {profileMenuItems.map((item) => {
                const isLogout = item.id === 'nav-logout-menu-item';
                const cls = `nav-drawer-btn ${isLogout ? 'nav-drawer-btn--accent' : 'nav-drawer-btn--secondary'}`;
                if (item.href && !isLogout) {
                  return (
                    <a
                      key={item.id}
                      id={item.id}
                      className={cls}
                      href={item.href}
                      onClick={(e) => {
                        e.preventDefault();
                        item.onClick();
                        onClose();
                      }}
                    >
                      <span className="nav-acct" aria-hidden="true">{item.icon}</span>
                      {item.label}
                    </a>
                  );
                }
                return (
                  <button
                    key={item.id}
                    id={item.id}
                    type="button"
                    className={cls}
                    onClick={() => {
                      item.onClick();
                      onClose();
                    }}
                  >
                    <span className="nav-acct" aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="nav-drawer-account">
              <a
                className="nav-drawer-btn nav-drawer-btn--secondary"
                href={loginHref}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigate(loginHref);
                }}
              >
                <span className="nav-acct" aria-hidden="true">
                  <AccountIcon />
                </span>
                {t('nav.account')}
              </a>
            </div>
          )}
        </div>

        {showScrollCue && (
          <button
            type="button"
            className="nav-drawer-more"
            onClick={scrollToBottom}
            aria-label="Scroll to see more"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
