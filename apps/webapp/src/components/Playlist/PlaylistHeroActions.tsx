import React, { useEffect, useRef, useState } from "react";
import { Tooltip } from "@resomix/ui";
import { playlistAccessChrome, PLAYLIST_LOCK_MARK } from "@/utils/playlistAccessChrome.ts";
import { PLAYLIST_DIVIDER_BORDER } from "@/utils/playlistChrome.ts";
import { WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";
import { HERO_TOOLBAR_BTN, HeroAutoplayToggle, RenameIcon, ExportIcon, ShareIcon } from "@/components/Playlist/heroToolbar.tsx";

type AccessChrome = ReturnType<typeof playlistAccessChrome>;

interface PlaylistHeroActionsProps {
  /** Prefix for the control ids, so the hero copy and the sticky-bar copy never share one. */
  idPrefix: string;
  /** Prefix for the export menu item ids. */
  menuIdPrefix?: string;
  autoplay: boolean;
  onToggleAutoplay: () => void;
  renameChrome: AccessChrome;
  exportChrome: AccessChrome;
  shareChrome: AccessChrome;
  isExporting: boolean;
  onRename: () => void;
  onShare: () => void;
  /**
   * Called when Export is pressed. Returns false when the press was answered some other way (the
   * guest login gate) and the menu should stay shut.
   */
  onExportPress: () => boolean;
  onExportTxt: () => void;
  onExportApple: () => void;
  onExportEmbed: () => void;
}

const MENU_ITEM =
  `w-full px-[var(--px-12)] py-[var(--px-10)] text-left font-fira text-[length:var(--px-9)] font-light tracking-[var(--px-0-25)] text-[var(--rx-color-text-primary)] transition-colors hover:bg-[rgba(255,255,255,0.06)] ${WORKSPACE_FOCUS_VISIBLE} flex items-center gap-[var(--px-8)]`;

/**
 * The playlist's Autoplay / Rename / Export / Share controls.
 *
 * Rendered twice on the desktop playlist: in the hero toolbar, and in the sticky reference bar once
 * the hero has scrolled away. The hero owns every handler, gate and modal, so both copies behave
 * identically. Each copy keeps its own export menu, because the menu has to open under the button
 * that was pressed.
 */
export const PlaylistHeroActions: React.FC<PlaylistHeroActionsProps> = ({
  idPrefix,
  menuIdPrefix = "export-menu",
  autoplay,
  onToggleAutoplay,
  renameChrome,
  exportChrome,
  shareChrome,
  isExporting,
  onRename,
  onShare,
  onExportPress,
  onExportTxt,
  onExportApple,
  onExportEmbed,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const exportButtonWrapRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        exportButtonWrapRef.current &&
        exportMenuRef.current &&
        !exportButtonWrapRef.current.contains(target) &&
        !exportMenuRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

  const handleExportClick = () => {
    if (onExportPress()) setMenuOpen((v) => !v);
  };

  // Every option closes the menu first, then hands over to the hero.
  const pick = (run: () => void) => () => {
    setMenuOpen(false);
    run();
  };

  return (
    <>
      <Tooltip message={autoplay ? "Turn off Autoplay" : "Turn on Autoplay"}>
        <button
          type="button"
          aria-pressed={autoplay}
          aria-label={autoplay ? "Turn off Autoplay" : "Turn on Autoplay"}
          onClick={onToggleAutoplay}
          className={`${HERO_TOOLBAR_BTN} ${WORKSPACE_FOCUS_VISIBLE}`}
          id={`${idPrefix}-autoplay-toggle`}
        >
          <HeroAutoplayToggle on={autoplay} />
          Autoplay
        </button>
      </Tooltip>
      <Tooltip message="Rename your Playlist">
        <button
          type="button"
          title={renameChrome.title}
          aria-label="Rename"
          onClick={onRename}
          className={`${HERO_TOOLBAR_BTN} ${WORKSPACE_FOCUS_VISIBLE}${renameChrome.className}`}
          id={`${idPrefix}-rename-button`}
        >
          <RenameIcon />
          Rename{renameChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}
        </button>
      </Tooltip>
      <div ref={exportButtonWrapRef} className="relative">
        <Tooltip message="Export your Playlist">
          <button
            type="button"
            title={exportChrome.title}
            aria-label="Export"
            onClick={handleExportClick}
            disabled={isExporting}
            className={`${HERO_TOOLBAR_BTN} disabled:cursor-not-allowed ${WORKSPACE_FOCUS_VISIBLE}${exportChrome.className}`}
            id={`${idPrefix}-export-button`}
          >
            <ExportIcon />
            {isExporting ? "Exporting..." : "Export"}{exportChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}
          </button>
        </Tooltip>
        {menuOpen && (
          <div
            ref={exportMenuRef}
            role="menu"
            aria-label="Export options"
            className={`absolute right-0 top-[calc(100%+var(--px-6))] z-50 min-w-[var(--px-220)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] text-[var(--rx-color-text-primary)] shadow-lg`}
          >
            <button
              role="menuitem"
              className={MENU_ITEM}
              onClick={pick(onExportTxt)}
              id={`${menuIdPrefix}-download`}
            >
              Export to TXT
            </button>
            <button
              role="menuitem"
              className={`${MENU_ITEM} border-t ${PLAYLIST_DIVIDER_BORDER}`}
              onClick={pick(onExportApple)}
              id={`${menuIdPrefix}-apple`}
            >
              Export to Apple Music
            </button>
            <button
              role="menuitem"
              className={`${MENU_ITEM} border-t ${PLAYLIST_DIVIDER_BORDER}`}
              onClick={pick(onExportEmbed)}
              id={`${menuIdPrefix}-embed`}
            >
              Embed (iframe)
            </button>
          </div>
        )}
      </div>
      <Tooltip message="Share your Playlist">
        <button
          type="button"
          title={shareChrome.title}
          aria-label="Share"
          onClick={onShare}
          className={`${HERO_TOOLBAR_BTN} ${WORKSPACE_FOCUS_VISIBLE}${shareChrome.className}`}
          id={`${idPrefix}-share-button`}
        >
          <ShareIcon />
          Share{shareChrome.showLock ? ` ${PLAYLIST_LOCK_MARK}` : ""}
        </button>
      </Tooltip>
    </>
  );
};

export default PlaylistHeroActions;
