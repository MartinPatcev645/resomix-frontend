import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ProfileDropdown } from '@resomix/ui';
import { useAuthStore, useFeedbackStore } from '@resomix/stores';
import { LogoHeader } from '../icons/LogoHeader.tsx';
import { MenuIcon } from '../icons/MenuIcon.tsx';
import {
  BETA_URL,
  CATALOGUE_PILOT_HREF,
  NAV_TOP_GROUPS,
  getNavSectionForPath,
  type NavTopGroup,
} from './betaNavConfig.ts';
import { NavPanelContent, CaretIcon, AccountIcon, buildProfileMenuItems } from './NavMenuContent.tsx';
import { useHeaderScroll, useMegaMenu } from './useMegaMenu.ts';
import { navT } from './navCopy.ts';
import './navigation.css';

interface SiteHeaderProps {
  variant: 'desktop' | 'mobile';
  onNavigate: (path: string) => void;
  onMenuOpen?: () => void;
  onProfileClick?: () => void;
  menuButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

type MegaMenuApi = ReturnType<typeof useMegaMenu>;

function NavGroupList({
  groups,
  megaMenu,
  currentSection,
  currentPath,
  hash,
  onNavigate,
  withPanels = true,
  idPrefix = '',
  setItemRef = megaMenu.setItemRef,
}: {
  groups: NavTopGroup[];
  megaMenu: MegaMenuApi;
  currentSection: ReturnType<typeof getNavSectionForPath>;
  currentPath: string;
  hash: string;
  onNavigate: (path: string) => void;
  withPanels?: boolean;
  idPrefix?: string;
  setItemRef?: MegaMenuApi['setItemRef'];
}) {
  return (
    <ul>
      {groups.map((group) => {
        const index = NAV_TOP_GROUPS.findIndex((g) => g.key === group.key);
        const isOpen = megaMenu.openIndex === index;
        const isSection = currentSection === group.key;
        const panelId = idPrefix ? `${idPrefix}${group.panelId}` : group.panelId;
        const noteId = group.key === 'solutions' ? `${idPrefix}planned-note` : undefined;
        return (
          <li
            key={group.key}
            id={idPrefix ? `${idPrefix}mi-${group.key}` : `mi-${group.key}`}
            className={`${isOpen ? 'is-open' : ''}${isSection ? ' is-section' : ''}`}
            ref={(el) => setItemRef(index, el)}
          >
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- hover bridge spans trigger + panel gap */}
            <div
              className="nav-mm-item-wrap"
              role="group"
              onPointerEnter={(e) => megaMenu.handlePointerEnter(index, e.pointerType)}
              onPointerLeave={(e) => megaMenu.handlePointerLeave(index, e.pointerType)}
              onKeyDown={(e) => megaMenu.handleItemKeyDown(index, e)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  megaMenu.handleFocusOut(index);
                }
              }}
            >
              <button
                type="button"
                className="nav-mm-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => megaMenu.handleTriggerClick(index)}
                onKeyDown={(e) => megaMenu.handleTriggerKeyDown(index, e)}
              >
                {navT(`nav.topGroups.${group.key}`)}
                {isSection ? <span className="nav-sr">{navT('nav.currentSection')}</span> : null}
                <CaretIcon />
              </button>
              {withPanels ? (
                <div
                  className={`nav-mm-pop${group.side === 'right' ? ' nav-mm-pop--align-right' : ''}`}
                  id={panelId}
                >
                  <div className="nav-mm-panel">
                    <NavPanelContent
                      group={group}
                      pathname={currentPath}
                      hash={hash}
                      onNavigate={onNavigate}
                      noteId={noteId}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SiteHeader({
  variant,
  onNavigate,
  onMenuOpen,
  onProfileClick,
  menuButtonRef,
}: SiteHeaderProps) {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { showFeedbackForm } = useFeedbackStore();
  const isScrolled = useHeaderScroll();
  const megaMenu = useMegaMenu(NAV_TOP_GROUPS.length);
  const currentSection = getNavSectionForPath(location.pathname);
  const currentPath = location.pathname;
  const hash = location.hash;

  const leftGroups = NAV_TOP_GROUPS.filter((g) => g.side === 'left');
  const rightGroups = NAV_TOP_GROUPS.filter((g) => g.side === 'right');

  const loginHref = `${BETA_URL}/auth/login?redirect=${encodeURIComponent(currentPath + location.search)}`;

  const handleLogout = useCallback(async () => {
    try {
      const { logout } = await import('@resomix/api-client');
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      useAuthStore.getState().logout();
      onNavigate('/auth/login');
    }
  }, [onNavigate]);

  const profileMenuItems = buildProfileMenuItems({
    onNavigate,
    onProfileClick,
    onLogout: handleLogout,
  });

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate('/');
  };

  const accountControl = isAuthenticated ? (
    <ProfileDropdown
      align="right"
      items={profileMenuItems}
      trigger={
        <button type="button" className="nav-acct" aria-label={navT('nav.account')}>
          <AccountIcon />
        </button>
      }
    />
  ) : (
    <a
      className="nav-acct"
      href={loginHref}
      aria-label={navT('nav.account')}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(loginHref);
      }}
    >
      <AccountIcon />
    </a>
  );

  const feedbackCta = (
    <button
      type="button"
      className="nav-cta nav-cta-primary"
      id="nav-feedback-button"
      onClick={showFeedbackForm}
    >
      {navT('nav.cta.feedback')}
    </button>
  );

  const secondaryCta = (
    <a
      className="nav-cta nav-cta-secondary"
      href={CATALOGUE_PILOT_HREF}
      onClick={(e) => {
        e.preventDefault();
        window.location.href = CATALOGUE_PILOT_HREF;
      }}
    >
      {navT('nav.cta.cataloguePilot')}
    </a>
  );

  const logoLink = (
    <a href="/" aria-label="Resomix home" onClick={handleLogoClick}>
      <LogoHeader className="nav-logo-mark" />
    </a>
  );

  const menuButton = (
    <button
      type="button"
      className="nav-hmenu"
      ref={menuButtonRef}
      aria-haspopup="dialog"
      aria-controls="nav-drawer"
      aria-expanded="false"
      aria-label={navT('nav.openMenu')}
      onClick={onMenuOpen}
    >
      <MenuIcon className="w-[var(--px-25)] h-[var(--px-17)]" />
    </button>
  );

  const navListProps = {
    megaMenu,
    currentSection,
    currentPath,
    hash,
    onNavigate,
  };

  const stickyItemRef = useCallback(
    (index: number, el: HTMLLIElement | null) => {
      if (isScrolled) megaMenu.setItemRef(index, el);
    },
    [isScrolled, megaMenu],
  );

  const mainItemRef = useCallback(
    (index: number, el: HTMLLIElement | null) => {
      if (!isScrolled) megaMenu.setItemRef(index, el);
    },
    [isScrolled, megaMenu],
  );

  useLayoutEffect(() => {
    if (megaMenu.openIndex === null) return;
    const group = NAV_TOP_GROUPS[megaMenu.openIndex];
    const panelId = isScrolled ? `sticky-${group.panelId}` : group.panelId;
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const container = panel.closest('.nav-hframe, .nav-sticky-in') as HTMLElement | null;
    const anchorId = isScrolled ? `sticky-mi-${group.key}` : `mi-${group.key}`;
    const anchor = document.getElementById(anchorId);
    if (!container || !anchor) return;

    const trigger = anchor.querySelector('.nav-mm-trigger') as HTMLElement | null;
    const panelInner = panel.querySelector('.nav-mm-panel') as HTMLElement | null;
    if (!trigger || !panelInner) return;

    const containerRect = container.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = panelInner.offsetWidth;

    if (group.side === 'right') {
      panel.style.left = 'auto';
      if (isScrolled) {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const safeRight = 1.75 * rem;
        panel.style.right = `${window.innerWidth - containerRect.right + safeRight}px`;
      } else {
        panel.style.right = '';
      }
    } else {
      panel.style.right = 'auto';
      let left = triggerRect.left - containerRect.left;
      const maxLeft = Math.max(0, containerRect.width - panelWidth);
      left = Math.max(0, Math.min(left, maxLeft));
      if (isScrolled) {
        panel.style.left = `${triggerRect.left}px`;
      } else {
        panel.style.left = `${left}px`;
      }
    }
  }, [isScrolled, megaMenu.openIndex]);

  const prevScrolledRef = useRef(isScrolled);
  useLayoutEffect(() => {
    if (prevScrolledRef.current !== isScrolled && megaMenu.openIndex !== null) {
      megaMenu.closeAll(false);
    }
    prevScrolledRef.current = isScrolled;
  }, [isScrolled, megaMenu]);

  if (variant === 'mobile') {
    return (
      <header className="nav-site">
        <div className="nav-hframe">
          <div className="nav-mrow">
            <div className="nav-mrow-logo">{logoLink}</div>
            <div className="nav-mrow-right">
              {accountControl}
              {menuButton}
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      {megaMenu.openIndex !== null ? (
        <div
          className="nav-scrim"
          aria-hidden="true"
          onPointerDown={() => megaMenu.closeAll(false)}
        />
      ) : null}
      <header className={`nav-site${isScrolled ? ' is-scrolled' : ''}`} id="site-header">
        <div className="nav-hframe">
          <div className="nav-mrow">
            <div className="nav-mrow-logo">{logoLink}</div>
            <div className="nav-mrow-right">
              {accountControl}
              {menuButton}
            </div>
          </div>

          <nav className="nav-cl nav-cl-left nav-hnav" aria-label="Primary">
            <NavGroupList groups={leftGroups} {...navListProps} setItemRef={mainItemRef} />
          </nav>

          <div className="nav-cl nav-cl-logo">{logoLink}</div>

          <div className="nav-cl nav-cl-right">
            <nav className="nav-hnav" aria-label="Primary continued">
              <NavGroupList groups={rightGroups} {...navListProps} setItemRef={mainItemRef} />
            </nav>
            {accountControl}
          </div>

          <div className="nav-rail2">
            {secondaryCta}
            {feedbackCta}
          </div>
        </div>
      </header>

      <header
        className={`nav-sticky${isScrolled ? ' is-visible' : ''}`}
        id="site-header-sticky"
        aria-hidden={!isScrolled}
      >
        <div className="nav-sticky-in">
          <nav className="nav-cl nav-cl-left nav-hnav" aria-label="Primary">
            <NavGroupList
              groups={leftGroups}
              {...navListProps}
              idPrefix="sticky-"
              setItemRef={stickyItemRef}
            />
          </nav>

          <div className="nav-cl nav-cl-logo">{logoLink}</div>

          <div className="nav-cl nav-cl-right">
            <nav className="nav-hnav" aria-label="Primary continued">
              <NavGroupList
                groups={rightGroups}
                {...navListProps}
                idPrefix="sticky-"
                setItemRef={stickyItemRef}
              />
            </nav>
            {accountControl}
            {feedbackCta}
          </div>
        </div>
      </header>
    </>
  );
}
