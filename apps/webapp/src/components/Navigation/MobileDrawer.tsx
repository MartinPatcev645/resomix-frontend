import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuthStore, useFeedbackStore } from '@resomix/stores';
import {
  BETA_URL,
  CATALOGUE_PILOT_HREF,
  NAV_TOP_GROUPS,
  NAV_UTILITY_LINKS,
  getNavSectionForPath,
} from './betaNavConfig.ts';
import {
  NavPanelContent,
  CaretIcon,
  AccountIcon,
  AnalysisIcon,
  CataloguePilotIcon,
  LibraryIcon,
  LogoutIcon,
} from './NavMenuContent.tsx';
import { openCookiePreferences, isCookiePreferencesAvailable } from './cookiePreferences.ts';
import { navT } from './navCopy.ts';
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
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { showFeedbackForm } = useFeedbackStore();
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
  const loginHref = `${BETA_URL}/auth/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  useLayoutEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const page = document.getElementById('webapp-page-root');
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
      onNavigate('/auth/login');
      onClose();
    }
  }, [onClose, onNavigate]);

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
      aria-label={navT('nav.drawerLabel')}
      onPointerDown={handleBackdropClick}
    >
      <div className="nav-drawer-panel">
        <div className="nav-drawer-top">
          <span className="nav-lbl">{navT('nav.drawerTitle')}</span>
          <button
            type="button"
            className="nav-drawer-x"
            ref={closeRef}
            aria-label={navT('nav.closeMenu')}
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
                  {navT(`nav.topGroups.${group.key}`)}
                  {isSection ? (
                    <span className="nav-sr">{navT('nav.currentSection')}</span>
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
            <p className="nav-mm-group">{navT('nav.groups.resourcesCompany')}</p>
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
                        {navT(`nav.utility.${link.key}`)}
                      </button>
                    </li>
                  );
                }
                const label = navT(`nav.utility.${link.key}`);
                if (link.external) {
                  return (
                    <li key={link.key}>
                      <a
                        href={link.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={link.externalAriaKey ? navT(`nav.${link.externalAriaKey}`) : undefined}
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
                        window.location.href = link.route;
                        onClose();
                      }}
                    >
                      {label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* App destinations + the pilot share the utility grid's two-column layout, so the
              drawer has ONE link style. These used to appear twice: as this list AND again as a
              column of icon buttons below the feedback CTA, pointing at the same routes. */}
          <div className="nav-util nav-util--app">
            <ul>
              {isAuthenticated ? (
                <>
                  <li>
                    <a
                      href="/library"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('/library');
                      }}
                    >
                      <span className="nav-util-icon" aria-hidden="true">
                        <LibraryIcon />
                      </span>
                      {navT('nav.appLinks.library')}
                    </a>
                  </li>
                  <li>
                    <a
                      href="/track-intelligence"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate('/track-intelligence');
                      }}
                    >
                      <span className="nav-util-icon" aria-hidden="true">
                        <AnalysisIcon />
                      </span>
                      {navT('nav.appLinks.analysis')}
                    </a>
                  </li>
                  <li>
                    <a
                      href="/profile"
                      onClick={(e) => {
                        e.preventDefault();
                        // Honour the host's profile handler (WebLayout routes it) when provided,
                        // exactly as the old profile menu item did.
                        if (onProfileClick) {
                          onProfileClick();
                          onClose();
                        } else {
                          handleNavigate('/profile');
                        }
                      }}
                    >
                      <span className="nav-util-icon" aria-hidden="true">
                        <AccountIcon inList />
                      </span>
                      {navT('nav.appLinks.profile')}
                    </a>
                  </li>
                </>
              ) : null}
              <li>
                <a
                  href={CATALOGUE_PILOT_HREF}
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = CATALOGUE_PILOT_HREF;
                    onClose();
                  }}
                >
                  <span className="nav-util-icon" aria-hidden="true">
                    <CataloguePilotIcon />
                  </span>
                  {navT('nav.cta.cataloguePilot')}
                </a>
              </li>
            </ul>
          </div>

          {/* Signed out only: the way in. Sits ABOVE the feedback CTA — below it, an account
              action reads as part of the footer and gets mistaken for the primary button. Signed-in destinations live in the grid above, and
              logout is on the header's account button (mobile shows only Logout there). */}
          {!isAuthenticated && (
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
                {navT('nav.account')}
              </a>
            </div>
          )}

          {/* Feedback is the drawer's one accent-filled action. */}
          <button
            type="button"
            className="nav-drawer-btn nav-drawer-btn--primary"
            id="nav-drawer-feedback-button"
            onClick={() => {
              showFeedbackForm();
              onClose();
            }}
            style={{ marginTop: '1rem' }}
          >
            {navT('nav.cta.feedback')}
          </button>

          {/* Signed in: logout closes the drawer's list of actions. Kept out of the link grid
              above — it is not a destination, and it should not sit a thumb-slip from Profile. */}
          {isAuthenticated && (
            <div className="nav-drawer-account">
              <button
                type="button"
                id="nav-logout-menu-item"
                className="nav-drawer-btn nav-drawer-btn--accent"
                onClick={handleLogout}
              >
                <span className="nav-acct" aria-hidden="true">
                  <LogoutIcon />
                </span>
                {navT('nav.logout')}
              </button>
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
