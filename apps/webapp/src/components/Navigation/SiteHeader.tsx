import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ProfileDropdown } from '@resomix/ui';
import { useAuthStore, useFeedbackStore } from '@resomix/stores';
import { useEntitlements } from '@resomix/hooks';
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
  leadingItem,
  trailingItem,
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
  /** Extra <li> appended after the groups — used for plain links that have no mega panel. */
  leadingItem?: React.ReactNode;
  trailingItem?: React.ReactNode;
}) {
  return (
    <ul>
      {leadingItem}
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
                      // Selecting a destination must dismiss the panel — without this the
                      // page changed underneath while the dropdown stayed open over it.
                      // NavPanelContent already calls onClose; only the desktop header
                      // never passed one (the mobile drawer did, which is why it closed).
                      onClose={() => megaMenu.closeAll(false)}
                      noteId={noteId}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
      {trailingItem}
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
  // Plan-aware CTA. `useEntitlements` is already cached app-wide, so this costs no extra request.
  const { plan } = useEntitlements();
  const isPro = plan?.code === 'pro';
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
    isPro,
  });

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate('/');
  };

  /**
   * Logout only — derived from the full list rather than rebuilt, so the item keeps a single
   * definition (id, icon, handler) and can never drift from the desktop one.
   */
  const mobileProfileMenuItems = profileMenuItems.filter(
    (item) => item.id === 'nav-logout-menu-item',
  );

  /**
   * The header account control.
   *
   * Signed out → straight to the beta login page. Signed in → the account dropdown, whose contents
   * differ by variant: desktop carries the full set, MOBILE offers Logout only. Every other
   * destination (Profile, Library, Analysis) is already one tap away in the mobile drawer, so
   * repeating them in a second, smaller menu is a duplicate navigation surface.
   */
  const renderAccountControl = (items: typeof profileMenuItems) =>
    isAuthenticated ? (
      <ProfileDropdown
        align="right"
        items={items}
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

  const accountControl = renderAccountControl(profileMenuItems);
  const mobileAccountControl = renderAccountControl(mobileProfileMenuItems);

  /**
   * Pricing — GUESTS ONLY, rendered as a NAV ITEM leading the right-hand group, which is exactly
   * where and how the marketing header presents it. It is a plain link rather than a group: there
   * is one destination, so a dropdown would be a menu of one.
   *
   * Signed-in users reach the same page from Upgrade / Manage in the account dropdown instead — a
   * header link saying "Pricing" to someone who already pays reads as though they are not
   * subscribed.
   */
  const onPricingPage = currentPath === '/subscribe';
  const pricingNavItem = (idPrefix = '') =>
    isAuthenticated ? null : (
      <li key="pricing" id={`${idPrefix}mi-pricing`} className={onPricingPage ? 'is-section' : ''}>
        <div className="nav-mm-item-wrap">
          <a
            className="nav-mm-trigger"
            href="/subscribe?from=app"
            id={`${idPrefix}nav-pricing-link`}
            aria-current={onPricingPage ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/subscribe?from=app');
            }}
          >
            {navT('nav.cta.pricing')}
            {onPricingPage ? <span className="nav-sr">{navT('nav.status.currentPage')}</span> : null}
          </a>
        </div>
      </li>
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

  /**
   * About wears the same chrome as the Product / Solutions triggers so the row reads as one set,
   * but it is a plain link: no caret, no panel, no mega-menu index (it can't "open", so it stays
   * out of the keyboard/pointer disclosure wiring entirely). The About page lives on the landing
   * site, so this is a full-page navigation. `idPrefix` keeps the sticky header's copy from
   * colliding with the main one.
   */
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

      // Work in VIEWPORT coordinates, then convert once against the real offset parent.
      //
      // `.nav-cl` is `position: absolute`, so it — not `.nav-hframe` — is what a left on the panel
      // resolves against. Measuring the offset from `.nav-hframe` and assigning it anyway pushed
      // every left-side panel right by the column's own inset, and the further along the bar the
      // trigger sat the worse it got. Mirrors the fix in the landing header.
      const offsetParent = (panel.offsetParent as HTMLElement | null) ?? container;
      const parentLeft = offsetParent.getBoundingClientRect().left;

      const minX = containerRect.left;
      const maxX = Math.max(minX, containerRect.right - panelWidth);
      const x = Math.max(minX, Math.min(triggerRect.left, maxX));

      panel.style.left = `${x - parentLeft}px`;
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
              {mobileAccountControl}
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
            <NavGroupList
              groups={leftGroups}
              {...navListProps}
              setItemRef={mainItemRef}
            />
          </nav>

          <div className="nav-cl nav-cl-logo">{logoLink}</div>

          <div className="nav-cl nav-cl-right">
            <nav className="nav-hnav" aria-label="Primary continued">
              <NavGroupList
                groups={rightGroups}
                {...navListProps}
                setItemRef={mainItemRef}
                leadingItem={pricingNavItem()}
              />
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
                leadingItem={pricingNavItem('sticky-')}
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
