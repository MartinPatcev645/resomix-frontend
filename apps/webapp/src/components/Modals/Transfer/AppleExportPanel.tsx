import React from 'react';
import { PAGE_BTN_PRIMARY, PAGE_BTN_SECONDARY } from '@resomix/ui';
import AppleMusicIcon from '@/assets/icons/cc/apple-music.svg';

export type AppleNotice = { kind: 'success' | 'error' | 'info'; text: string } | null;

interface Props {
  connected: boolean;
  storefront: string | null;
  statusLoading: boolean;
  connectLoading: boolean;
  transferLoading: boolean;
  ready: boolean;
  notice: AppleNotice;
  /** Set after a successful transfer → shows an "Open in Apple Music" link (opens in a new tab). */
  playlistUrl?: string | null;
  log: string[];
  hasPlaylist: boolean;
  onConnect: () => void;
  onTransfer: () => void;
  onDisconnect: () => void;
}

const AppleExportPanel: React.FC<Props> = ({
  connected,
  storefront,
  statusLoading,
  connectLoading,
  transferLoading,
  ready,
  notice,
  playlistUrl,
  log,
  hasPlaylist,
  onConnect,
  onTransfer,
  onDisconnect,
}) => {
  const busy = connectLoading || transferLoading;

  // Keep the activity log short (≤ 4 lines) and always pinned to the newest lines, so it can't grow
  // the modal vertically. The scrollbar is hidden — older lines are still reachable by wheel/trackpad.
  const logRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const primaryText = connected
    ? (transferLoading ? 'Adding…' : 'Add to Apple Music')
    : (connectLoading ? 'Connecting…' : ready ? 'Connect Apple Music' : 'Preparing…');

  return (
    <div className="mt-[var(--px-6)] flex w-full flex-col gap-[var(--px-14)] text-left">
      {/* Connection status */}
      <div className="flex items-center gap-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)]">
        {/* Apple Music mark, to the left of the connection state */}
        <img
          src={AppleMusicIcon}
          alt="Apple Music"
          draggable={false}
          className="w-[var(--px-16)] h-[var(--px-16)] shrink-0"
        />
        <span
          className={
            'inline-block w-[var(--px-8)] h-[var(--px-8)] rounded-full ' +
            (statusLoading
              ? 'bg-[var(--rx-color-text-muted)] animate-pulse'
              : connected
                ? 'bg-[var(--rx-color-success)]'
                : 'bg-[var(--rx-color-border-strong)]')
          }
          aria-hidden="true"
        />
        <span className="text-[var(--rx-color-text-secondary)]">
          {statusLoading ? 'Checking your Apple Music connection…' : connected ? 'Connected' : 'Not connected'}
        </span>
        {connected && storefront && (
          <span className="ml-[var(--px-4)] rounded-[var(--rx-radius-tag,2px)] border border-[var(--rx-color-border-default)] px-[var(--px-6)] py-[var(--px-1)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">
            {storefront}
          </span>
        )}
      </div>

      {!statusLoading && (
        <p className="font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)] opacity-85">
          {connected
            ? 'Your account is linked. Add this playlist to your Apple Music library — a new playlist will be created there.'
            : 'Link your Apple Music account to send this playlist straight to your library. You only need to connect once — we’ll remember it. An active Apple Music subscription is required.'}
        </p>
      )}

      {/* Single action. No Close button — the dialog shell's ✕ is the universal exit. */}
      <button
        type="button"
        onClick={connected ? onTransfer : onConnect}
        disabled={busy || statusLoading || (!connected && !ready) || (connected && !hasPlaylist)}
        className={`${PAGE_BTN_PRIMARY} self-center px-[var(--px-24)]`}
        id={connected ? 'apple-export-transfer' : 'apple-export-connect'}
      >
        {primaryText}
      </button>

      {connected && (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={busy}
          className="self-start font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)] underline underline-offset-2 transition-colors hover:text-[var(--rx-color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          id="apple-export-disconnect"
        >
          Disconnect Apple Music
        </button>
      )}

      {/* Standardized notice */}
      {notice && (
        <div
          role="status"
          className={
            'border px-[var(--px-10)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase leading-[var(--px-15)] tracking-[var(--px-1)] ' +
            (notice.kind === 'success'
              ? 'border-[var(--rx-color-success)] bg-[rgba(99,210,143,0.08)] text-[var(--rx-color-success)]'
              : notice.kind === 'error'
                ? 'border-[var(--rx-color-error)] bg-[rgba(255,118,96,0.08)] text-[var(--rx-color-error)]'
                : 'border-[var(--rx-color-border-default)] text-[var(--rx-color-text-secondary)]')
          }
        >
          {notice.text}
        </div>
      )}

      {/* Open the created playlist in Apple Music (new tab). Shown once the transfer produced a URL. */}
      {playlistUrl && (
        <a
          href={playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${PAGE_BTN_SECONDARY} self-center gap-[var(--px-8)] px-[var(--px-24)]`}
          id="apple-export-open-playlist"
        >
          <span>Open in Apple Music</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[var(--px-12)] h-[var(--px-12)]" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}

      {/* Activity log — appended line by line, themed to match the system */}
      {log.length > 0 && (
        <div
          ref={logRef}
          className="max-h-[var(--px-72)] overflow-y-auto border border-[var(--rx-color-border-subtle)] bg-black/30 px-[var(--px-10)] py-[var(--px-8)] text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Apple Music activity log"
        >
          {log.map((line, i) => (
            <div
              key={i}
              className="whitespace-pre-wrap break-words text-left font-fira text-[length:var(--px-9)] leading-[var(--px-14)] text-[var(--rx-color-text-muted)] opacity-70"
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppleExportPanel;
