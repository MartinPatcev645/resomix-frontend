import React from 'react';
import { ButtonSleek } from '@resomix/ui';

export type AppleNotice = { kind: 'success' | 'error' | 'info'; text: string } | null;

interface Props {
  connected: boolean;
  storefront: string | null;
  statusLoading: boolean;
  connectLoading: boolean;
  transferLoading: boolean;
  notice: AppleNotice;
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
  notice,
  hasPlaylist,
  onConnect,
  onTransfer,
  onDisconnect,
}) => {
  const busy = connectLoading || transferLoading;

  return (
    <div className="w-full flex flex-col gap-[var(--px-14)] mt-[var(--px-14)]">
      {/* Connection status pill */}
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

      {/* Body */}
      {!statusLoading && (
        <div className="flex flex-col gap-[var(--px-12)]">
          {!connected ? (
            <>
              <p className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-16)] text-[var(--color-primary)]/70">
                Link your Apple Music account to send this playlist straight to your library. You only need
                to connect once — we’ll remember it for next time. An active Apple Music subscription is required.
              </p>
              <ButtonSleek
                text={connectLoading ? 'Connecting…' : 'Connect Apple Music'}
                onClick={onConnect}
                disabled={busy}
                className="cta-button primary"
                id="apple-export-connect"
              />
            </>
          ) : (
            <>
              <p className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-16)] text-[var(--color-primary)]/70">
                Your account is linked. Add this playlist to your Apple Music library — a new playlist will
                be created there.
              </p>
              <ButtonSleek
                text={transferLoading ? 'Adding…' : 'Add to Apple Music'}
                onClick={onTransfer}
                disabled={busy || !hasPlaylist}
                className="cta-button primary"
                id="apple-export-transfer"
              />
              <button
                type="button"
                onClick={onDisconnect}
                disabled={busy}
                className="self-start text-[length:var(--px-10)] font-light font-fira text-[var(--color-primary)]/50 hover:text-[var(--color-primary)]/80 underline underline-offset-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                id="apple-export-disconnect"
              >
                Disconnect Apple Music
              </button>
            </>
          )}
        </div>
      )}

      {/* Standardized notice */}
      {notice && (
        <div
          role="status"
          className={
            'text-[length:var(--px-10)] font-light font-fira leading-[var(--px-15)] px-[var(--px-10)] py-[var(--px-8)] border border-dotted rounded-[var(--px-4)] ' +
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
    </div>
  );
};

export default AppleExportPanel;
