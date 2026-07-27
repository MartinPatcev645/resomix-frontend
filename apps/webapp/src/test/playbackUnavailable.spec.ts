import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { PlaybackUnavailable } from "@/components/Playlist/PlaybackUnavailable.tsx";

describe("PlaybackUnavailable", () => {
  it("compact mode renders in-row copy and bordered retry", () => {
    const onRetry = vi.fn();
    render(createElement(PlaybackUnavailable, { onRetry, compact: true, detail: "fixture-error" }));

    expect(screen.getByText("Playback unavailable")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry.className).toContain("border");
    retry.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
