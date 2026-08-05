import React, { useEffect, useId, useRef, useState } from 'react';
import AppleMusicIcon from '@/assets/icons/cc/apple-music.svg';

/**
 * A small "Tip" pill that lives in the top-right corner of the Apple export modal. It gently
 * pulses to draw the eye (until first opened), and on hover (desktop) or tap/click (mobile +
 * desktop) reveals a professional popover explaining that the exported playlist shows up inside
 * rekordbox via Apple Music. Closes on: click again, click outside, or Escape.
 *
 * Fully self-contained — no external state. Anchor it inside a `position: relative` container
 * (the modal shell already is) and it positions itself.
 */
const RekordboxTip: React.FC = () => {
  const [open, setOpen] = useState(false);     // pinned open by click/tap
  const [hover, setHover] = useState(false);   // desktop hover preview
  const [seen, setSeen] = useState(false);     // stop the blink once interacted with
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tipId = useId();

  const visible = open || hover;

  // Close when clicking anywhere outside the pill/popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHover(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setHover(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setSeen(true);
    setOpen((v) => !v);
  };

  return (
    <div
      ref={wrapRef}
      // `flex` so the wrapper shrink-wraps the button exactly — a block wrapper adds ~3px of
      // line-box leading, which made the halo span (inset-0) taller than the pill and pushed the
      // ring off-centre (gap at the top). top offset ≥ the halo's 15px reach so the ring clears the
      // modal's top edge. The right offset clears the dialog shell's ✕ (28px wide at a 10px inset)
      // plus room for the halo, so the pill can never sit under the close button.
      className="absolute flex top-[var(--px-20)] right-[var(--px-48)] z-20"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* The pill */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Tip: using this playlist in rekordbox"
        aria-expanded={visible}
        aria-describedby={visible ? tipId : undefined}
        className={
          'relative inline-flex items-center gap-[var(--px-6)] rounded-[var(--rx-radius-control)] ' +
          'px-[var(--px-10)] py-[var(--px-4)] border border-[var(--rx-color-border-default)] ' +
          'bg-[rgba(255,255,255,0.03)] ' +
          'text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] font-fira ' +
          'text-[var(--rx-color-text-muted)] hover:text-[var(--rx-color-text-primary)] ' +
          'hover:border-[var(--rx-color-border-strong)] transition-colors cursor-pointer'
        }
      >
        {/* Blinking accent dot — stops once the tip has been opened */}
        <span
          className={
            'inline-block w-[var(--px-6)] h-[var(--px-6)] rounded-full bg-[var(--rx-color-success)] ' +
            (seen ? '' : 'animate-pulse')
          }
          aria-hidden="true"
        />
        Tip
      </button>

      {/* Soft pulsing halo to catch the eye before first interaction. Uses an expanding box-shadow
          (not Tailwind's animate-ping) so it grows a uniform ~15px outward from the pill's edge on
          all sides — no directional bias — and fades out, at a gentle pace. */}
      {!seen && (
        <>
          <style>{`
            @keyframes rbxTipRing {
              0%   { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.40); }
              70%  { box-shadow: 0 0 0 15px rgba(74, 222, 128, 0); }
              100% { box-shadow: 0 0 0 15px rgba(74, 222, 128, 0); }
            }
          `}</style>
          {/* Square radius so the halo follows the pill's own (square) edge — it used to be a
              rounded ring around a square pill. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[var(--rx-radius-control)]"
            style={{ animation: 'rbxTipRing 2.2s ease-out infinite' }}
          />
        </>
      )}

      {/* The popover */}
      {visible && (
        <div
          id={tipId}
          role="tooltip"
          className={
            'absolute right-0 top-[calc(100%+var(--px-8))] w-[var(--px-280)] max-w-[80vw] ' +
            'bg-[var(--rx-color-surface-raised)] border border-[var(--rx-color-border-default)] ' +
            'shadow-2xl px-[var(--px-14)] py-[var(--px-12)] text-left z-30'
          }
        >
          <div className="flex items-center gap-[var(--px-8)] mb-[var(--px-8)]">
            <img
              src={AppleMusicIcon}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="w-[var(--px-16)] h-[var(--px-16)]"
            />
            <span className="font-fira text-[length:var(--px-10)] font-medium uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-primary)]">
              Using this in rekordbox
            </span>
          </div>

          <p className="font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-18)] text-[var(--rx-color-text-secondary)] opacity-85">
            Once your Resomix sonic discovery is exported, open the playlist in rekordbox and you’ll
            find the same tracks waiting under your Apple Music playlists. No re-import, no manual
            matching, because rekordbox reads the playlist straight from Apple Music.
          </p>

          <p className="mt-[var(--px-8)] font-helvetica text-[length:var(--px-11)] font-light leading-[var(--px-16)] text-[var(--rx-color-text-muted)] opacity-60">
            Requires an active Apple Music subscription and a rekordbox plan that supports streaming
            integration.
          </p>
        </div>
      )}
    </div>
  );
};

export default RekordboxTip;
