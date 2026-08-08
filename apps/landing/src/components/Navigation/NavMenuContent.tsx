import React from 'react';
import { useTranslation } from 'react-i18next';
import { openCookiePreferences, isCookiePreferencesAvailable } from './cookiePreferences.ts';
import { NavGlyph } from './NavGlyphs.tsx';
import type { NavItem, NavPanelNotice, NavTopGroup } from './navData.ts';
import { isCurrentNavRoute } from './navData.ts';
import { prefetchRoute } from '@/routes/pageLoaders.ts';

export const CaretIcon = () => (
  <svg className="nav-caret" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M1.5 3.25 5 6.75 8.5 3.25" />
  </svg>
);

function StatusChip({ status }: { status: NavItem['status'] }) {
  const { t } = useTranslation('common');
  if (!status) return null;
  const chipClass =
    status === 'coming-next'
      ? 'nav-chip nav-chip-next'
      : 'nav-chip nav-chip-scope';
  const labelKey =
    status === 'coming-next' ? 'nav.status.comingNext' : 'nav.status.scopingAvailable';
  return <span className={chipClass}>{t(labelKey)}</span>;
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
  const { t } = useTranslation('common');
  const isCurrent = item.live && item.route
    ? isCurrentNavRoute(pathname, hash, item.route)
    : false;

  const title = (
    <span className="nav-mm-t">
      {t(`nav.items.${item.key}.title`)}
      {item.status ? <StatusChip status={item.status} /> : null}
      {isCurrent ? (
        <span className="nav-chip nav-chip-current">{t('nav.status.currentPage')}</span>
      ) : null}
      {item.external ? (
        <span className="nav-ext" aria-hidden="true">
          ↗ {t('nav.external')}
        </span>
      ) : null}
    </span>
  );

  const description = (
    <p className="nav-mm-d">{t(`nav.items.${item.key}.description`)}</p>
  );

  if (item.isCookieSettings) {
    const available = isCookiePreferencesAvailable();
    return (
      <button
        type="button"
        className={`nav-mm-row${item.featured ? ' nav-mm-featured' : ''}`}
        aria-describedby={describedBy}
        disabled={!available}
        onClick={() => {
          if (openCookiePreferences()) onClose?.();
        }}
      >
        {item.glyph ? <NavGlyph name={item.glyph} /> : null}
        {title}
        {description}
      </button>
    );
  }

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
    // Let the browser handle the intents an <a> is expected to honour: cmd/ctrl-click and
    // middle-click open a new tab, shift opens a window. Calling preventDefault unconditionally
    // swallowed all of them and navigated the current tab instead.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    if (item.external) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      onNavigate(href);
    }
    onClose?.();
  };

  /* Start the chunk download on hover/focus. The pointer still has to travel to the link and the
     click still has to happen, and that is usually enough time for the page to be in memory by the
     time it does — which is the difference between an instant transition and a network-bound one. */
  const warm = () => {
    if (!item.external) prefetchRoute(href);
  };

  const ariaLabel = item.external && item.externalAriaKey
    ? t(`nav.${item.externalAriaKey}`)
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
        onMouseEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
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
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
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
  const { t } = useTranslation('common');

  if (group.columns) {
    return (
      <>
        <div className="nav-mm-cols">
          {group.columns.map((col) => (
            <div
              key={col.groupLabelKey ?? col.items[0]?.key ?? 'col'}
              className="nav-mm-col"
              style={{ flex: col.flex }}
            >
              {col.groupLabelKey ? (
                <p className="nav-mm-group" id={`g-${col.groupLabelKey}`}>
                  {t(`nav.groups.${col.groupLabelKey}`)}
                </p>
              ) : null}
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
              <ul
                className="nav-mm-list"
                aria-labelledby={col.groupLabelKey ? `g-${col.groupLabelKey}` : undefined}
              >
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
            {t(`nav.notes.${group.noteKey}`)}
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
            {t(`nav.groups.${group.groupLabelKey}`)}
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
        <p className="nav-mm-note">{t(`nav.notes.${group.noteKey}`)}</p>
      ) : null}
    </>
  );
}

function NavNotice({ notice }: { notice: NavPanelNotice }) {
  const { t } = useTranslation('common');
  return (
    <div className="nav-mm-notice">
      <p className="nav-nt">{t(`nav.notices.${notice.titleKey}`)}</p>
      <p>{t(`nav.notices.${notice.bodyKey}`)}</p>
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
