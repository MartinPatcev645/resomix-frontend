import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { PlaylistHeroActions } from "../components/Playlist/PlaylistHeroActions.tsx";

/**
 * The playlist's Autoplay / Rename / Export / Share controls render twice on desktop, in the hero
 * and in the sticky bar. Both copies run the hero's handlers; each keeps its own export menu.
 */

const open = { className: "", showLock: false };

function setup(overrides: Partial<React.ComponentProps<typeof PlaylistHeroActions>> = {}) {
  const props = {
    idPrefix: "playlist-sticky",
    menuIdPrefix: "playlist-sticky-export-menu",
    autoplay: false,
    onToggleAutoplay: vi.fn(),
    renameChrome: open,
    exportChrome: open,
    shareChrome: open,
    isExporting: false,
    onRename: vi.fn(),
    onShare: vi.fn(),
    onExportPress: vi.fn(() => true),
    onExportTxt: vi.fn(),
    onExportApple: vi.fn(),
    onExportEmbed: vi.fn(),
    ...overrides,
  };
  render(<PlaylistHeroActions {...props} />);
  return props;
}

describe("playlist hero actions", () => {
  it("hands every press to the hero's handlers", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Turn on Autoplay" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(p.onToggleAutoplay).toHaveBeenCalledTimes(1);
    expect(p.onRename).toHaveBeenCalledTimes(1);
    expect(p.onShare).toHaveBeenCalledTimes(1);
  });

  it("uses its own ids, so the sticky copy never repeats the hero's", () => {
    setup();
    expect(document.getElementById("playlist-sticky-autoplay-toggle")).toBeInTheDocument();
    expect(document.getElementById("playlist-sticky-rename-button")).toBeInTheDocument();
    expect(document.getElementById("playlist-sticky-export-button")).toBeInTheDocument();
    expect(document.getElementById("playlist-sticky-share-button")).toBeInTheDocument();
    expect(document.getElementById("playlist-hero-export-button")).not.toBeInTheDocument();
  });

  it("opens the export menu, and an option closes it and runs the hero's handler", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("menu", { name: "Export options" })).toBeInTheDocument();
    expect(document.getElementById("playlist-sticky-export-menu-apple")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Export to Apple Music" }));
    expect(p.onExportApple).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps the menu shut when the hero answers the press itself (the guest login gate)", () => {
    const p = setup({ onExportPress: vi.fn(() => false) });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(p.onExportPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu on Escape and on a click outside", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
