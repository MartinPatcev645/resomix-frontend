import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The October 2026 plan change, at the two places the browser decides on its own.
 *
 *   - The Track Intelligence PDF is built in the browser, so the button's verdict is the only gate.
 *     Free keeps the button, tagged "Pro", and a press opens the upgrade prompt instead of a file.
 *   - A guest's locked picker option now unlocks with a free account, so it must not say "Premium".
 *
 * The plan numbers themselves (guest 20 of 50, free 50 of 100) are server values and are covered by
 * the backend tests; the playlist tables already blur whatever is past the unlocked count.
 */

const h = vi.hoisted(() => ({
  verdict: vi.fn<(action: string) => string>(),
  exportAnalysisPdf: vi.fn(async () => "Track - Resomix analysis.pdf"),
  entitlements: { dropdownMaxTracks: 50, loading: false, isGuest: true },
}));

vi.mock("@resomix/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@resomix/hooks")>();
  const reasons: Record<string, string | null> = {
    allowed: null,
    pending: null,
    upgrade: "upgrade_required",
    login: "login_required",
  };
  return {
    ...actual,
    useAccess: () => ({
      verdict: h.verdict,
      gateReason: (action: string) => reasons[h.verdict(action)] ?? null,
    }),
  };
});

vi.mock("../../../../packages/hooks/src/Entitlements/useEntitlements.ts", () => ({
  useEntitlements: () => h.entitlements,
}));

vi.mock("@/utils/entitlementCta.ts", () => ({ useEntitlementCta: () => ({ trigger: vi.fn() }) }));

vi.mock("../components/Analysis/export/exportAnalysisPdf.ts", () => ({
  exportAnalysisPdf: h.exportAnalysisPdf,
}));

const { ExportPdfButton } = await import("../components/Analysis/export/ExportPdfButton.tsx");
const { useTrackCountOptions } = await import("@resomix/hooks");

// The button never reads the analysis itself; it hands it to the (mocked) builder.
const data = {} as Parameters<typeof ExportPdfButton>[0]["data"];

beforeEach(() => {
  h.verdict.mockReset();
  h.exportAnalysisPdf.mockClear();
});

describe("Track Intelligence PDF export", () => {
  it("tags the button Pro for a free account and opens the upgrade prompt instead of a file", async () => {
    h.verdict.mockReturnValue("upgrade");
    render(<ExportPdfButton data={data} />);

    expect(screen.getByText("Pro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /export pdf/i }));

    expect(await screen.findByText("PDF export is a Pro feature")).toBeInTheDocument();
    expect(h.exportAnalysisPdf).not.toHaveBeenCalled();
  });

  it("builds the PDF for Pro, with no tag", async () => {
    h.verdict.mockReturnValue("allowed");
    render(<ExportPdfButton data={data} />);

    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /export pdf/i }));

    await waitFor(() => expect(h.exportAnalysisPdf).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("PDF export is a Pro feature")).not.toBeInTheDocument();
  });

  it("stays inert while the plan is still loading, so neither state flashes", () => {
    h.verdict.mockReturnValue("pending");
    render(<ExportPdfButton data={data} />);

    expect(screen.getByRole("button", { name: /export pdf/i })).toBeDisabled();
    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
  });
});

describe("track count picker", () => {
  it("tells a guest that 100 tracks opens with a free account", () => {
    h.entitlements = { dropdownMaxTracks: 50, loading: false, isGuest: true };
    const { result } = renderHook(() => useTrackCountOptions());
    const label = (v: number) => result.current.options.find((o) => o.value === v)?.label;

    expect(label(50)).toBe("50 tracks");
    expect(label(100)).toBe("100 tracks (Log in)");
    expect(result.current.lockedCtaAction).toBe("login");
  });

  it("locks nothing for a free account, which can create up to 100", () => {
    h.entitlements = { dropdownMaxTracks: 100, loading: false, isGuest: false };
    const { result } = renderHook(() => useTrackCountOptions());

    expect(result.current.options.every((o) => !o.locked)).toBe(true);
    expect(result.current.hasLockedOptions).toBe(false);
  });

  it("still says Premium for a signed-in plan below 100", () => {
    h.entitlements = { dropdownMaxTracks: 50, loading: false, isGuest: false };
    const { result } = renderHook(() => useTrackCountOptions());

    expect(result.current.options.find((o) => o.value === 100)?.label).toBe("100 tracks (Premium)");
  });
});
