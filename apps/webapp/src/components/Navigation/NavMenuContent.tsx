import React from 'react';
import { NavGlyph } from './NavGlyphs.tsx';
import type { NavItem, NavPanelNotice, NavTopGroup } from './betaNavConfig.ts';
import { isCurrentNavRoute } from './betaNavConfig.ts';
import { navT } from './navCopy.ts';

export const CaretIcon = () => (
  <svg className="nav-caret" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M1.5 3.25 5 6.75 8.5 3.25" />
  </svg>
);

function StatusChip({ status }: { status: NavItem['status'] }) {
  if (!status) return null;
  const chipClass =
    status === 'coming-next'
      ? 'nav-chip nav-chip-next'
      : 'nav-chip nav-chip-scope';
  const labelKey =
    status === 'coming-next' ? 'nav.status.comingNext' : 'nav.status.scopingAvailable';
  return <span className={chipClass}>{navT(labelKey)}</span>;
}

interface NavLinkRowProps {
  item: NavItem;
  pathname: string;
  hash: string;
  onNavigate: (path: string) => void;
  onClose?: () => void;
  describedBy?: string;
}

export function NavLinkRow({
  item,
  pathname,
  hash,
  onNavigate,
  onClose,
  describedBy,
}: NavLinkRowProps) {
  const isCurrent = item.live && item.route
    ? isCurrentNavRoute(pathname, hash, item.route)
    : false;

  const title = (
    <span className="nav-mm-t">
      {navT(`nav.items.${item.key}.title`)}
      {item.status ? <StatusChip status={item.status} /> : null}
      {isCurrent ? (
        <span className="nav-chip nav-chip-current">{navT('nav.status.currentPage')}</span>
      ) : null}
      {item.external ? (
        <span className="nav-ext" aria-hidden="true">
          ↗ {navT('nav.external')}
        </span>
      ) : null}
    </span>
  );

  const description = (
    <p className="nav-mm-d">{navT(`nav.items.${item.key}.description`)}</p>
  );

  if (!item.live) {
    return (
      <div
        className={`nav-mm-row${item.featured ? ' nav-mm-featured' : ''}`}
        aria-describedby={describedBy}
      >
        {item.glyph ? <NavGlyph name={item.glyph} /> : null}
        {title}
        {description}
      </div>
    );
  }

  const href = item.route ?? '#';
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (item.external) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = href;
      onNavigate(href);
    }
    onClose?.();
  };

  const ariaLabel = item.external && item.externalAriaKey
    ? navT(`nav.${item.externalAriaKey}`)
    : undefined;

  if (item.featured) {
    return (
      <a
        className="nav-mm-featured"
        href={href}
        aria-current={isCurrent ? 'page' : undefined}
        aria-label={ariaLabel}
        {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={handleClick}
      >
        {title}
        {description}
      </a>
    );
  }

  return (
    <a
      className="nav-mm-link"
      href={href}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={handleClick}
    >
      {item.glyph ? <NavGlyph name={item.glyph} /> : null}
      {title}
      {description}
    </a>
  );
}

interface NavPanelContentProps {
  group: NavTopGroup;
  pathname: string;
  hash: string;
  onNavigate: (path: string) => void;
  onClose?: () => void;
  noteId?: string;
}

export function NavPanelContent({
  group,
  pathname,
  hash,
  onNavigate,
  onClose,
  noteId,
}: NavPanelContentProps) {
  if (group.columns) {
    return (
      <>
        <div className="nav-mm-cols">
          {group.columns.map((col) => (
            <div key={col.groupLabelKey} className="nav-mm-col" style={{ flex: col.flex }}>
              <p className="nav-mm-group" id={`g-${col.groupLabelKey}`}>
                {navT(`nav.groups.${col.groupLabelKey}`)}
              </p>
              {col.featured ? (
                <NavLinkRow
                  item={col.featured}
                  pathname={pathname}
                  hash={hash}
                  onNavigate={onNavigate}
                  onClose={onClose}
                  describedBy={noteId}
                />
              ) : null}
              <ul className="nav-mm-list" aria-labelledby={`g-${col.groupLabelKey}`}>
                {col.items.map((item) => (
                  <li key={item.key}>
                    <NavLinkRow
                      item={item}
                      pathname={pathname}
                      hash={hash}
                      onNavigate={onNavigate}
                      onClose={onClose}
                      describedBy={noteId}
                    />
                  </li>
                ))}
              </ul>
              {col.notice ? <NavNotice notice={col.notice} /> : null}
            </div>
          ))}
        </div>
        {group.noteKey ? (
          <p className="nav-mm-note" id={noteId}>
            {navT(`nav.notes.${group.noteKey}`)}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <>
      {group.featured ? (
        <NavLinkRow
          item={group.featured}
          pathname={pathname}
          hash={hash}
          onNavigate={onNavigate}
          onClose={onClose}
        />
      ) : null}
      {group.groupLabelKey && group.items ? (
        <>
          <p className="nav-mm-group" id={`g-${group.key}`}>
            {navT(`nav.groups.${group.groupLabelKey}`)}
          </p>
          <ul className="nav-mm-list" aria-labelledby={`g-${group.key}`}>
            {group.items.map((item) => (
              <li key={item.key}>
                <NavLinkRow
                  item={item}
                  pathname={pathname}
                  hash={hash}
                  onNavigate={onNavigate}
                  onClose={onClose}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {group.noteKey ? (
        <p className="nav-mm-note">{navT(`nav.notes.${group.noteKey}`)}</p>
      ) : null}
    </>
  );
}

function NavNotice({ notice }: { notice: NavPanelNotice }) {
  return (
    <div className="nav-mm-notice">
      <p className="nav-nt">{navT(`nav.notices.${notice.titleKey}`)}</p>
      <p>{navT(`nav.notices.${notice.bodyKey}`)}</p>
    </div>
  );
}

export function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.5 7.063C16.5 10.258 14.57 13 12 13c-2.572 0-4.5-2.742-4.5-5.938C7.5 3.868 9.16 2 12 2s4.5 1.867 4.5 5.063zM4.102 20.142C4.487 20.6 6.145 22 12 22c5.855 0 7.512-1.4 7.898-1.857a.416.416 0 0 0 .09-.317C19.9 18.944 19.106 15 12 15s-7.9 3.944-7.989 4.826a.416.416 0 0 0 .091.317z"
        fill="currentColor"
      />
    </svg>
  );
}

export const LibraryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full" aria-hidden="true">
    <path d="M4 4h2v16H4V4zm5 0h2v16H9V4zm4.5 0h2l3.5 16h-2l-3.5-16z" fill="currentColor" />
  </svg>
);

export const AnalysisIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full" aria-hidden="true">
    <path d="M3 3v18h18M7 17V13m4 4V9m4 8v-6m4 6V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full" aria-hidden="true">
    <path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CataloguePilotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full" aria-hidden="true">
    <path
      d="M12 3 3 7.5 12 12l9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function buildProfileMenuItems({
  onNavigate,
  onProfileClick,
  onLogout,
}: {
  onNavigate: (path: string) => void;
  onProfileClick?: () => void;
  onLogout: () => void;
}) {
  return [
    {
      label: 'Profile',
      id: 'nav-profile-menu-item',
      href: '/profile',
      icon: <AccountIcon />,
      onClick: () => onProfileClick?.() ?? onNavigate('/profile'),
    },
    {
      label: 'Library',
      id: 'nav-library-menu-item',
      href: '/library',
      icon: <LibraryIcon />,
      onClick: () => onNavigate('/library'),
    },
    {
      label: 'Analysis',
      id: 'nav-analysis-menu-item',
      href: '/analysis',
      icon: <AnalysisIcon />,
      onClick: () => onNavigate('/analysis'),
    },
    {
      label: 'Logout',
      id: 'nav-logout-menu-item',
      separated: true,
      icon: <LogoutIcon />,
      onClick: onLogout,
    },
  ];
}
