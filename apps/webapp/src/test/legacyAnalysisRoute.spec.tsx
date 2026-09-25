import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { LegacyAnalysisRedirect } from "@/routes/LegacyAnalysisRedirect.tsx";

/**
 * The page moved from `/analysis` to `/track-intelligence` in September 2026, and the old links
 * are out in the world: shared in chats, bookmarked, sitting in someone's notes. Each one carries
 * the analysis id as a query string, so losing the query on the way through the redirect would be
 * the same as losing the link.
 */

const Landed = () => {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="landed">{`${pathname}${search}${hash}`}</div>;
};

const openAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/analysis" element={<LegacyAnalysisRedirect to="/track-intelligence" />} />
        <Route path="/analysis/full" element={<LegacyAnalysisRedirect to="/track-intelligence/full" />} />
        <Route path="/track-intelligence" element={<Landed />} />
        <Route path="/track-intelligence/full" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the old analysis links", () => {
  it("opens the summary at its new address", () => {
    openAt("/analysis");
    expect(screen.getByTestId("landed")).toHaveTextContent("/track-intelligence");
  });

  it("carries the analysis id through, which is the whole point", () => {
    openAt("/analysis?id=8f21c0de-4a6b-4d2e-9c11-5b7a0e3f9d22");
    expect(screen.getByTestId("landed").textContent).toBe(
      "/track-intelligence?id=8f21c0de-4a6b-4d2e-9c11-5b7a0e3f9d22",
    );
  });

  it("keeps the tab a link was shared on", () => {
    openAt("/analysis/full?id=abc&tab=harmony");
    expect(screen.getByTestId("landed").textContent).toBe("/track-intelligence/full?id=abc&tab=harmony");
  });

  it("keeps a hash as well", () => {
    openAt("/analysis?id=abc#stems");
    expect(screen.getByTestId("landed").textContent).toBe("/track-intelligence?id=abc#stems");
  });
});
