import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ProfileDropdown } from '@resomix/ui';
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
  buildProfileMenuItems,
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

  const profileMenuItems = buildProfileMenuItems({
    onNavigate: (path) => {
      onNavigate(path);
      onClose();
    },
    onProfileClick: onProfileClick
      ? () => {
          onProfileClick();
          onClose();
        }
      : undefined,
    onLogout: handleLogout,
  });

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

        <div className="nav-drawer-scroll">
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

          {isAuthenticated ? (
            <div className="nav-drawer-app-links">
              <a
                className="nav-drawer-acct"
                href="/library"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigate('/library');
                }}
              >
                {navT('nav.appLinks.library')}
              </a>
              <a
                className="nav-drawer-acct"
                href="/analysis"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigate('/analysis');
                }}
              >
                {navT('nav.appLinks.analysis')}
              </a>
            </div>
          ) : null}

          <button
            type="button"
            className="nav-drawer-feedback"
            id="nav-drawer-feedback-button"
            onClick={() => {
              showFeedbackForm();
              onClose();
            }}
          >
            {navT('nav.cta.feedback')}
          </button>

          <div className="nav-drawer-cta">
            <a
              className="nav-cta nav-cta-secondary"
              href={CATALOGUE_PILOT_HREF}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = CATALOGUE_PILOT_HREF;
                onClose();
              }}
            >
              {navT('nav.cta.cataloguePilot')}
            </a>
          </div>

          {isAuthenticated ? (
            <ProfileDropdown
              align="right"
              items={profileMenuItems}
              trigger={
                <button type="button" className="nav-drawer-acct">
                  <span className="nav-acct" aria-hidden="true">
                    <AccountIcon />
                  </span>
                  {navT('nav.account')}
                </button>
              }
            />
          ) : (
            <a
              className="nav-drawer-acct"
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
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
