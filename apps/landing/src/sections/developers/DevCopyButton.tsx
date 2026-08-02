import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The copy control used on every code block on /developers.
 *
 * Four of these existed with four near-identical handlers; the confirmation lived only in a toast,
 * so the button itself gave no sign it had done anything. It now shows a tick beside the label and
 * clears itself, and owns the clipboard call so the behaviour can't drift between call sites.
 */

/** How long the tick stays up after a successful copy. */
const COPIED_RESET_MS = 1500;

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="dev-copybtn-tick"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

interface DevCopyButtonProps {
  /** Resolved lazily so the caller's current selection is copied, not the one at render time. */
  getText: () => string;
  onCopy: (message: string) => void;
}

export function DevCopyButton({ getText, onCopy }: DevCopyButtonProps) {
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  // Clearing on unmount avoids a setState on a component the user has navigated away from.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getText());
      onCopy('Code copied to clipboard');
      setCopied(true);
      // Restart the window on a repeat click rather than letting the first timer cut it short.
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // A failed copy must not show the tick — that would claim something that did not happen.
      onCopy('Copy failed');
    }
  }, [getText, onCopy]);

  return (
    <button
      type="button"
      className="dev-copybtn uppercase"
      onClick={handleCopy}
      data-copied={copied || undefined}
    >
      {copied && <CheckIcon />}
      {t('developers.console.copy')}
    </button>
  );
}
