import React from "react";
import { Dialog } from "@resomix/ui";

/**
 * BaseExportModal — now a compatibility shim over the shared `Dialog`.
 *
 * It used to be its own overlay, and it had three real problems the shell fixes:
 *   • not portaled, at `z-50` — below the sticky nav (80) and the mobile drawer (120), and trapped
 *     inside the page's `z-30` content wrapper;
 *   • no focus trap, no focus restore;
 *   • its default width asked for `--px-600`, a token defined in NEITHER app, so the `lg:` width
 *     silently did nothing. Sizing now goes through the shell's size scale.
 *
 * The prop surface is unchanged so every consumer keeps working untouched (Apple export, Embed, and
 * the parked Spotify/Tidal/Download modals). New modals should use `Dialog` directly.
 */
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;

  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Mono kicker above the title. Defaults to "Playlist // Export". */
  eyebrow?: string;
  iconSrc?: string;
  iconAlt?: string;
  header?: React.ReactNode;

  containerClassName?: string;
  contentClassName?: string;
  /** Escape hatch for a bespoke width. Prefer leaving this unset — see EXPORT_WIDTH. */
  widthClassName?: string;
}

/**
 * One width for every export/transfer modal. These are short, single-decision panels; the old `lg`
 * default (and the broken `--px-600`) made them far wider than their content, so they read as empty.
 * Matches the Embed modal, which was already the right size.
 */
const EXPORT_WIDTH = "max-w-[var(--px-500)]";

const BaseExportModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  eyebrow = "Playlist // Export",
  iconSrc,
  iconAlt,
  header,
  containerClassName,
  contentClassName,
  widthClassName,
}) => {
  // `header` fully replaces the icon/title/subtitle block, so pass it as body content above the
  // children rather than fighting the shell's header slot.
  const usesCustomHeader = Boolean(header);

  const icon = !usesCustomHeader && iconSrc ? (
    <img
      src={iconSrc}
      aria-hidden="true"
      loading="lazy"
      draggable={false}
      alt={iconAlt || "Modal"}
      className="h-[var(--px-40)] w-[var(--px-40)]"
    />
  ) : undefined;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      icon={icon}
      eyebrow={usesCustomHeader ? undefined : eyebrow}
      title={usesCustomHeader ? undefined : title}
      subtitle={usesCustomHeader ? undefined : subtitle}
      ariaLabel={typeof title === "string" ? title : "Export"}
      widthClassName={widthClassName ?? EXPORT_WIDTH}
      className={containerClassName}
    >
      {usesCustomHeader ? <div className="w-full">{header}</div> : null}
      <div className={`w-full ${contentClassName || ""}`}>{children}</div>
    </Dialog>
  );
};

export default BaseExportModal;
