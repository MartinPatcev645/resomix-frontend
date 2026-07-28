import React from 'react';
import BaseModal from '@/components/Modals/BaseExportModal.js';
import ExportSvg from '@/assets/icons/export.svg';
import { ButtonSleek } from '@resomix/ui';

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

function buildSnippet(uuid: string, theme: EmbedTheme): string {
  const src = `${EMBED_BASE}/?id=${uuid}&theme=${theme}`;
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
  const publicNow = isPublic || madePublic;
  const snippet = React.useMemo(() => buildSnippet(playlistUuid, theme), [playlistUuid, theme]);

  React.useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setMadePublic(false);
      setTheme('dark');
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
      onStatusChange?.('success', 'Playlist is now public — you can embed it.', 'Ready to Embed');
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
      widthClassName="max-w-[var(--px-500)] w-full lg:w-[var(--px-480)]"
    >
      <div className="w-full flex flex-col gap-[var(--px-14)] mt-[var(--px-14)]">
        {!publicNow ? (
          <>
            <p className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-16)] text-[var(--color-primary)]/70">
              Embedding only works on <strong>public</strong> playlists. Make this playlist public to
              generate an embed code — you can make it private again anytime.
            </p>
            <div className="flex flex-col sm:flex-row gap-[var(--px-10)] w-full">
              <ButtonSleek
                text={busy ? 'Making public…' : 'Make Public & Embed'}
                onClick={makePublic}
                disabled={busy}
                customWidth="w-full sm:flex-1"
                className="cta-button primary"
                id="embed-make-public"
              />
              <ButtonSleek
                text="Close"
                onClick={onClose}
                transparent
                customWidth="w-full sm:flex-1"
                className="cta-button secondary"
                id="embed-close"
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-16)] text-[var(--color-primary)]/70">
              Copy this code and paste it into an HTML block. The player shows the tracks with 30-second
              previews, and stays contained — visitors can’t navigate away.
            </p>

            {/* Theme toggle — writes ?theme= into the snippet. */}
            <div className="flex items-center gap-[var(--px-8)]">
              <span className="text-[length:var(--px-9)] uppercase tracking-[var(--px-0-5)] font-fira text-[var(--color-primary)]/50">
                Theme
              </span>
              <div className="inline-flex border border-dotted border-slate-200/30 rounded-full overflow-hidden">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={
                      'px-[var(--px-12)] py-[var(--px-4)] text-[length:var(--px-9)] uppercase tracking-[var(--px-0-5)] font-fira transition-colors ' +
                      (theme === t
                        ? 'bg-[var(--color-primary)] text-[var(--color-secondary)]'
                        : 'text-[var(--color-primary)]/60 hover:text-[var(--color-primary)]')
                    }
                    id={`embed-theme-${t}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="embed-snippet"
              readOnly
              value={snippet}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-[var(--px-90)] resize-none bg-black/40 border border-dotted border-slate-200/30 px-[var(--px-10)] py-[var(--px-8)] text-[length:var(--px-9)] font-fira text-[var(--color-primary)]/80 leading-[var(--px-14)]"
            />

            <div className="flex flex-col sm:flex-row gap-[var(--px-10)] w-full">
              <ButtonSleek
                text={copied ? 'Copied ✓' : 'Copy embed code'}
                onClick={copy}
                customWidth="w-full sm:flex-1"
                className="cta-button primary"
                id="embed-copy"
              />
              <ButtonSleek
                text="Close"
                onClick={onClose}
                transparent
                customWidth="w-full sm:flex-1"
                className="cta-button secondary"
                id="embed-close"
              />
            </div>

            <p className="text-[length:var(--px-9)] font-light font-fira leading-[var(--px-13)] text-[var(--color-primary)]/45">
              Tip: adjust <span className="text-[var(--color-primary)]/70">height</span> to fit your
              layout. On WordPress.com, paste it in a Custom HTML block.
            </p>
          </>
        )}
      </div>
    </BaseModal>
  );
};

export default EmbedModal;
