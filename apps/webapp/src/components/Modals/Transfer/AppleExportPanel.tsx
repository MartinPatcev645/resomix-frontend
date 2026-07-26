import React from 'react';
import { ButtonSleek } from '@resomix/ui';

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
  onClose: () => void;
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
  onClose,
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
    <div className="w-full flex flex-col gap-[var(--px-14)] mt-[var(--px-14)]">
      {/* Connection status */}
      <div className="flex items-center gap-[var(--px-8)] text-[length:var(--px-11)] font-fira">
        <span
          className={
            'inline-block w-[var(--px-8)] h-[var(--px-8)] rounded-full ' +
            (statusLoading ? 'bg-slate-400 animate-pulse' : connected ? 'bg-green-400' : 'bg-slate-500')
          }
          aria-hidden="true"
        />
        <span className="text-[var(--color-primary)]/80">
          {statusLoading ? 'Checking your Apple Music connection…' : connected ? 'Connected' : 'Not connected'}
        </span>
        {connected && storefront && (
          <span className="ml-[var(--px-4)] uppercase tracking-[var(--px-0-5)] text-[length:var(--px-9)] text-[var(--color-primary)]/50 border border-dotted border-slate-200/40 px-[var(--px-6)] py-[var(--px-1)] rounded-full">
            {storefront}
          </span>
        )}
      </div>

      {!statusLoading && (
        <p className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-16)] text-[var(--color-primary)]/70">
          {connected
            ? 'Your account is linked. Add this playlist to your Apple Music library — a new playlist will be created there.'
            : 'Link your Apple Music account to send this playlist straight to your library. You only need to connect once — we’ll remember it. An active Apple Music subscription is required.'}
        </p>
      )}

      {/* Actions — side by side on wider screens, stacked when space is tight */}
      <div className="flex flex-col sm:flex-row gap-[var(--px-10)] w-full">
        <ButtonSleek
          text={primaryText}
          onClick={connected ? onTransfer : onConnect}
          disabled={busy || statusLoading || (!connected && !ready) || (connected && !hasPlaylist)}
          customWidth="w-full sm:flex-1"
          className="cta-button primary"
          id={connected ? 'apple-export-transfer' : 'apple-export-connect'}
        />
        <ButtonSleek
          text="Close"
          onClick={onClose}
          transparent
          customWidth="w-full sm:flex-1"
          className="cta-button secondary"
          id="apple-export-close"
        />
      </div>

      {connected && (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={busy}
          className="self-start text-[length:var(--px-10)] font-light font-fira text-[var(--color-primary)]/50 hover:text-[var(--color-primary)]/80 underline underline-offset-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            'text-[length:var(--px-10)] font-light font-fira leading-[var(--px-15)] px-[var(--px-10)] py-[var(--px-8)] border border-dotted ' +
            (notice.kind === 'success'
              ? 'text-green-300 border-green-400/40 bg-green-400/5'
              : notice.kind === 'error'
                ? 'text-red-300 border-red-400/40 bg-red-400/5'
                : 'text-[var(--color-primary)]/70 border-slate-200/30')
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
          className="w-full flex items-center justify-center gap-[var(--px-8)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider px-[var(--px-20)] py-[var(--px-10)] transition-colors"
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
          className="border border-dotted border-slate-200/30 bg-black/30 px-[var(--px-10)] py-[var(--px-8)] max-h-[var(--px-72)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Apple Music activity log"
        >
          {log.map((line, i) => (
            <div
              key={i}
              className="text-[length:var(--px-9)] font-light font-fira leading-[var(--px-14)] text-[var(--color-primary)]/45 whitespace-pre-wrap break-words"
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
