import React from 'react';
import BaseModal from '@/components/Modals/BaseExportModal.js';
import ExportSvg from '@/assets/icons/export.svg';
import { PAGE_BTN_PRIMARY } from '@resomix/ui';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistUuid: string;
  isPublic: boolean;
  /** Make the playlist public (owner only). Resolves true on success. */
  onMakePublic: () => Promise<boolean>;
  onStatusChange?: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;
}

// Where the standalone embed widget is hosted (its own Cloudflare Pages project). Overridable via
// env; the iframe points here with ?id=<playlist uuid>.
const EMBED_BASE = (
  (import.meta.env.VITE_EMBED_URL as string | undefined)?.replace(/\/$/, '') || 'https://embed.resomix.com'
);

type EmbedTheme = 'dark' | 'light';

// The token authorises THIS playlist to be embedded (pricing v2.1, G1). Without it the widget
// shows its "not available" state — which is the point: a bare UUID used to render any public
// playlist for anyone, while embedding was sold as a Pro feature.
function buildSnippet(uuid: string, theme: EmbedTheme, token: string): string {
  const src = `${EMBED_BASE}/?id=${uuid}&theme=${theme}&t=${encodeURIComponent(token)}`;
  return (
    `<iframe src="${src}" width="100%" height="480" ` +
    `style="border:0;border-radius:12px" loading="lazy" ` +
    `allow="autoplay; encrypted-media" title="Resomix playlist"></iframe>`
  );
}

const EmbedModal: React.FC<EmbedModalProps> = ({
  isOpen,
  onClose,
  playlistUuid,
  isPublic,
  onMakePublic,
  onStatusChange,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [theme, setTheme] = React.useState<EmbedTheme>('dark');
  // Local flip so the snippet view appears right after the user makes it public, without waiting
  // for the store's is_public to refresh.
  const [madePublic, setMadePublic] = React.useState(false);
  // Minted server-side, and idempotent there: re-opening this modal returns the SAME token, so a
  // snippet already pasted into a live page keeps working.
  const [token, setToken] = React.useState<string | null>(null);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const publicNow = isPublic || madePublic;
  const snippet = React.useMemo(
    () => (token ? buildSnippet(playlistUuid, theme, token) : ''),
    [playlistUuid, theme, token],
  );

  // Mint as soon as the modal opens — deliberately NOT waiting for the playlist to be public.
  //
  // Whether the plan includes embedding has nothing to do with visibility, and gating the mint on
  // `publicNow` meant a free user had to publish their playlist FIRST and only then be told they
  // cannot embed it. They had changed something about their playlist to learn a fact we already
  // knew. Minting up front means the refusal arrives before anything is altered.
  React.useEffect(() => {
    if (!isOpen || token) return;
    let cancelled = false;
    void (async () => {
      const { mintEmbedToken } = await import('@resomix/api-client');
      const res = await mintEmbedToken(playlistUuid);
      if (cancelled) return;
      if (res.success) {
        setToken(res.data.token);
        return;
      }

      // A quota/plan denial (402) already opens the global upgrade modal, with copy chosen from
      // the server's `code`. Close this one instead of stacking a second dialog behind it — and
      // because everything left in here (theme toggle, empty snippet box, dead Copy button) is
      // useless once we know no token is coming.
      //
      // Anything WITHOUT a code is a genuine failure the global modal knows nothing about, so that
      // still reports inline.
      if ((res as { code?: string | null }).code) {
        onClose();
        return;
      }
      setTokenError((res as { error?: string }).error || 'Could not create the embed.');
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, token, playlistUuid, onClose]);

  React.useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setMadePublic(false);
      setTheme('dark');
      // Cleared so a re-open re-mints. The server returns the same token, so this costs one
      // request and cannot invalidate a live snippet.
      setToken(null);
      setTokenError(null);
    }
  }, [isOpen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — select the text so the user can copy manually.
      const el = document.getElementById('embed-snippet') as HTMLTextAreaElement | null;
      el?.select();
    }
  };

  const makePublic = async () => {
    setBusy(true);
    const ok = await onMakePublic();
    setBusy(false);
    if (ok) {
      setMadePublic(true);
      onStatusChange?.('success', 'Playlist is now public. You can embed it.', 'Ready to Embed');
    } else {
      onStatusChange?.('error', 'Could not make this playlist public.', 'Error');
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      iconSrc={ExportSvg}
      iconAlt="Embed"
      title="Embed this playlist"
      subtitle="Drop this playlist into WordPress, your site, or anywhere that accepts HTML."
      /* Width comes from BaseExportModal now, so every export/transfer modal matches. */
    >
      {/* Body copy is left-aligned; the shell centres its own header only. */}
      <div className="mt-[var(--px-6)] flex w-full flex-col gap-[var(--px-14)] text-left">
        {!publicNow ? (
          <>
            <p className="font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)] opacity-85">
              Embedding only works on <strong>public</strong> playlists. Make this playlist public to
              generate an embed code; you can make it private again anytime.
            </p>
            {/* No Close button — the dialog shell's ✕ is the universal exit. */}
            <button
              type="button"
              onClick={makePublic}
              disabled={busy}
              className={`${PAGE_BTN_PRIMARY} self-center px-[var(--px-24)]`}
              id="embed-make-public"
            >
              {busy ? 'Making public…' : 'Make Public & Embed'}
            </button>
          </>
        ) : (
          <>
            <p className="font-helvetica text-[length:var(--px-13)] font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)] opacity-85">
              Copy this code and paste it into an HTML block. The player shows the tracks with 30-second
              previews, and stays contained, so visitors can’t navigate away.
            </p>

            {/* Theme toggle — writes ?theme= into the snippet. */}
            <div className="flex items-center gap-[var(--px-8)]">
              <span className="font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]">
                Theme
              </span>
              <div className="inline-flex overflow-hidden rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)]">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={
                      'cursor-pointer px-[var(--px-12)] py-[var(--px-5)] font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] transition-colors ' +
                      (theme === t
                        ? 'bg-[var(--rx-color-accent)] text-[#050505]'
                        : 'text-[var(--rx-color-text-muted)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)]')
                    }
                    id={`embed-theme-${t}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* The snippet only exists once a token has been minted — a UUID alone no longer
                renders anything, so showing it early would hand the user a broken embed. */}
            {tokenError ? (
              <p className="font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-18)] text-[var(--color-accent,#EE4A26)]">
                {tokenError}
              </p>
            ) : !token ? (
              <p className="font-fira text-[length:var(--px-10)] uppercase tracking-[0.14em] text-[var(--rx-color-text-muted)] opacity-70">
                Preparing your embed…
              </p>
            ) : null}

            <textarea
              id="embed-snippet"
              readOnly
              value={snippet}
              onFocus={(e) => e.currentTarget.select()}
              className="h-[var(--px-90)] w-full resize-none border border-[var(--rx-color-border-default)] bg-black/40 px-[var(--px-10)] py-[var(--px-8)] text-left font-fira text-[length:var(--px-9)] leading-[var(--px-14)] text-[var(--rx-color-text-secondary)]"
            />

            <button
              type="button"
              onClick={copy}
              disabled={!token}
              className={`${PAGE_BTN_PRIMARY} self-center px-[var(--px-24)] ${!token ? 'opacity-50' : ''}`}
              id="embed-copy"
            >
              {copied ? 'Copied ✓' : 'Copy embed code'}
            </button>

            <p className="font-helvetica text-[length:var(--px-11)] font-light leading-[var(--px-16)] text-[var(--rx-color-text-muted)] opacity-70">
              Tip: adjust <span className="text-[var(--rx-color-text-secondary)]">height</span> to fit
              your layout. On WordPress.com, paste it in a Custom HTML block.
            </p>
          </>
        )}
      </div>
    </BaseModal>
  );
};

export default EmbedModal;
