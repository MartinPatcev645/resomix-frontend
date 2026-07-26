import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProfileDropdown } from '@resomix/ui';
import { useAuthStore } from '@resomix/stores';
import { BASE_BETA_URL } from '@resomix/config';
import {
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
  const [cookieSettingsEnabled] = useState(isCookiePreferencesAvailable);
  const currentSection = getNavSectionForPath(location.pathname);
  const loginHref = `${BASE_BETA_URL}/auth/login?redirect=${encodeURIComponent(location.pathname)}`;

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
      onNavigate('/auth/login');
      onClose();
    }
  }, [onClose, onNavigate]);

  const profileMenuItems = [
    {
      label: 'Profile',
      id: 'nav-drawer-profile-menu-item',
      href: `${BASE_BETA_URL}/profile`,
      icon: <AccountIcon />,
      onClick: () => {
        if (onProfileClick) onProfileClick();
        else onNavigate(`${BASE_BETA_URL}/profile`);
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
            <a
              className="nav-cta nav-cta-primary"
              href={BASE_BETA_URL}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = BASE_BETA_URL;
                onClose();
              }}
            >
              {t('nav.cta.tryResomix')}
            </a>
            <a
              className="nav-cta nav-cta-secondary"
              href="/partners/pilot"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('/partners/pilot');
              }}
            >
              {t('nav.cta.startPilot')}
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
                  {t('nav.account')}
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
              {t('nav.account')}
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
