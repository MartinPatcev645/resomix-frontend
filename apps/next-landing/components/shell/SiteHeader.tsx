'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoHeader } from '@/components/LogoHeader';
import { MenuIcon } from '@/components/MenuIcon';
import { BETA_URL, NAV_TOP_GROUPS, getNavSectionForPath, type NavTopGroup } from './navData';
import { NavPanelContent, CaretIcon, AccountIcon } from './NavMenuContent';
import { useHeaderScroll, useMegaMenu } from './useMegaMenu';
import { useT } from './copy';
import './navigation.css';

interface SiteHeaderProps {
  variant: 'desktop' | 'mobile';
  onNavigate: (path: string) => void;
  onMenuOpen?: () => void;
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
  t,
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
  t: (key: string) => string;
  withPanels?: boolean;
  idPrefix?: string;
  setItemRef?: MegaMenuApi['setItemRef'];
  /** Extra <li> rendered BEFORE the groups — a plain link that has no mega panel. */
  leadingItem?: React.ReactNode;
  /** Extra <li> appended after the groups — used for plain links that have no mega panel. */
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
                {t(`nav.topGroups.${group.key}`)}
                {isSection ? <span className="nav-sr">{t('nav.currentSection')}</span> : null}
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
  menuButtonRef,
}: SiteHeaderProps) {
  const t = useT();
  const pathname = usePathname() ?? '/';
  const [hash, setHash] = useState('');
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const isScrolled = useHeaderScroll();
  const megaMenu = useMegaMenu(NAV_TOP_GROUPS.length);
  const currentSection = getNavSectionForPath(pathname);
  const currentPath = pathname;

  const leftGroups = NAV_TOP_GROUPS.filter((g) => g.side === 'left');
  const rightGroups = NAV_TOP_GROUPS.filter((g) => g.side === 'right');

  /**
   * Signing in always happens on the WEBAPP (beta), never on the landing site, and lands you in
   * the workspace afterwards.
   *
   * `redirect` is resolved by the webapp's AuthPage against ITS OWN routes, so it has to be a
   * webapp path. This used to pass the current landing path, which sent you to
   * beta.resomix.com/<landing-route> after login — e.g. /partners, which does not exist there, so
   * a successful sign-in dropped you on a 404. '/' is the workspace root (it forwards to
   * /sonic-discovery).
   */
  const loginHref = `${BETA_URL}/auth/login?redirect=${encodeURIComponent('/')}`;

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate('/');
  };

  const handleCtaClick = (e: React.MouseEvent, href: string, external?: boolean) => {
    e.preventDefault();
    if (external) window.location.href = href;
    else onNavigate(href);
  };

  const accountControl = (
    <a
      className="nav-acct"
      href={loginHref}
      aria-label={t('nav.account')}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(loginHref);
      }}
    >
      <AccountIcon />
    </a>
  );

  const primaryCta = (
    <a
      className="nav-cta nav-cta-primary"
      href={BETA_URL}
      onClick={(e) => handleCtaClick(e, BETA_URL, true)}
    >
      {t('nav.cta.tryResomix')}
    </a>
  );

  const secondaryCta = (
    <a
      className="nav-cta nav-cta-secondary"
      href="/partners/pilot"
      onClick={(e) => handleCtaClick(e, '/partners/pilot')}
    >
      {t('nav.cta.cataloguePilot')}
    </a>
  );

  /**
   * About wears the same chrome as the Product / Solutions triggers so the row reads as one set,
   * but it is a plain link: no caret, no panel, no mega-menu index (it can't "open", so it stays
   * out of the keyboard/pointer disclosure wiring entirely). `idPrefix` keeps the sticky header's
   * copy from colliding with the main one.
   */
  // Pricing is a page, not a nav section, so `currentSection` never reports it — match on the path.
  // It is a plain link rather than a group: there is one destination, so a dropdown would be a
  // menu of one. (About moved into the Company group on the left, which is where it belongs.)
  const onPricingPage = currentPath === '/pricing';
  const pricingNavItem = (idPrefix = '') => (
    <li key="pricing" id={`${idPrefix}mi-pricing`} className={onPricingPage ? 'is-section' : ''}>
      <div className="nav-mm-item-wrap">
        <a
          className="nav-mm-trigger"
          href="/pricing"
          id={`${idPrefix}nav-pricing-link`}
          aria-current={onPricingPage ? 'page' : undefined}
          onClick={(e) => handleCtaClick(e, '/pricing')}
        >
          {t('nav.cta.pricing')}
          {onPricingPage ? <span className="nav-sr">{t('nav.status.currentPage')}</span> : null}
        </a>
      </div>
    </li>
  );

  const logoLink = (
    <Link href="/" aria-label="Resomix home" onClick={handleLogoClick}>
      <LogoHeader className="nav-logo-mark" />
    </Link>
  );

  const menuButton = (
    <button
      type="button"
      className="nav-hmenu"
      ref={menuButtonRef}
      aria-haspopup="dialog"
      aria-controls="nav-drawer"
      aria-expanded="false"
      aria-label={t('nav.openMenu')}
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
    t,
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
      // `.nav-cl` is `position: absolute`, so it — not `.nav-hframe` — is what a left/top on the
      // panel resolves against. Measuring the offset from `.nav-hframe` and assigning it anyway
      // pushed every left-side panel right by the column's own inset, and the further along the
      // bar the trigger sat the worse it got: Resources, third in the row, opened near mid-screen.
      const offsetParent = (panel.offsetParent as HTMLElement | null) ?? container;
      const parentLeft = offsetParent.getBoundingClientRect().left;

      // Align the panel's left edge to the trigger, then keep it inside the header frame.
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
            {primaryCta}
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
            {primaryCta}
          </div>
        </div>
      </header>
    </>
  );
}
