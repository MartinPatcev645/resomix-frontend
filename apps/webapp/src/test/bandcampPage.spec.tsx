import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import "@resomix/stores";
import { server } from "./server.ts";
import BandcampPage from "@/features/bandcamp/pages/BandcampPage.tsx";
import { bandcampHandlers, resetBandcampMock } from "@/features/bandcamp/mocks/bandcampHandlers.ts";

function renderPage(entry = "/library/bandcamp") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <BandcampPage pollingOptions={{ intervalMs: 20 }} />
    </MemoryRouter>,
  );
}

async function submitUsername(value: string) {
  const input = await screen.findByLabelText("Bandcamp username");
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
}

beforeEach(() => {
  window.localStorage.setItem("rmx_device_hash", "test-device");
  resetBandcampMock();
  server.use(...bandcampHandlers);
});

describe("BandcampPage", () => {
  it("shows the connect form, with the privacy note, when there is no connection", async () => {
    renderPage();
    expect(await screen.findByLabelText("Bandcamp username")).toBeInTheDocument();
    expect(screen.getByText(/we never ask for your Bandcamp password/i)).toBeInTheDocument();
  });

  it("asks GET /connection on open instead of probing the collection", async () => {
    let collectionCalls = 0;
    server.use(
      http.get("*/api/v1/bandcamp/collection", () => {
        collectionCalls += 1;
        return undefined;
      }),
    );
    renderPage();
    expect(await screen.findByLabelText("Bandcamp username")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search your collection")).not.toBeInTheDocument();
    expect(collectionCalls).toBe(0);
  });

  it("shows a connected but empty collection as connected, not as the connect form", async () => {
    server.use(
      http.get("*/api/v1/bandcamp/connection", () =>
        HttpResponse.json({
          success: true,
          data: { connected: true, username: "quietfan", status: "ready", last_synced_at: "2026-10-10T17:00:00", active_job_id: null, item_count: 0 },
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText("This collection is empty or has no public items.")).toBeInTheDocument();
    expect(screen.getByText("Connected as quietfan")).toBeInTheDocument();
  });

  it("resumes a running sync after a reload, from the job id the backend reports", async () => {
    const first = renderPage();
    await submitUsername("coolfan");
    expect(await screen.findByText("Importing your collection")).toBeInTheDocument();
    first.unmount();

    renderPage();
    expect(await screen.findByText("Importing your collection")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Your collection" }, { timeout: 8000 })).toBeInTheDocument();
  });

  it("opens on the failure view when the last sync failed with nothing imported", async () => {
    server.use(
      http.get("*/api/v1/bandcamp/connection", () =>
        HttpResponse.json({
          success: true,
          data: { connected: true, username: "coolfan", status: "failed", last_synced_at: null, active_job_id: null, item_count: 0 },
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText("Import failed", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("drops a stale search from the URL so it cannot filter the next connection", async () => {
    renderPage("/library/bandcamp?q=mvr341&page=2");
    await submitUsername("coolfan");
    await screen.findByRole("heading", { name: "Your collection" }, { timeout: 8000 });
    expect(await screen.findByText("30 items")).toBeInTheDocument();
    expect(screen.getByLabelText("Search your collection")).toHaveValue("");
  });

  it("rejects an artist page before calling the API", async () => {
    let connectCalls = 0;
    server.use(
      http.post("*/api/v1/bandcamp/connect", () => {
        connectCalls += 1;
        return undefined;
      }),
    );
    renderPage();
    await submitUsername("https://someartist.bandcamp.com");
    expect(await screen.findByRole("alert")).toHaveTextContent(/artist page/i);
    expect(screen.getByLabelText("Bandcamp username")).toHaveAttribute("aria-invalid", "true");
    expect(connectCalls).toBe(0);
  });

  it("explains how to make a private collection public", async () => {
    renderPage();
    await submitUsername("private");
    expect(await screen.findByText("This collection is private")).toBeInTheDocument();
    expect(screen.getByText(/Go to Settings, then Fan/)).toBeInTheDocument();
  });

  it.each([
    ["notfound", "We couldn't find that Bandcamp user."],
    ["artist", "Enter a fan username, not an artist page."],
    ["ratelimited", "Too many requests, try again in a minute."],
  ])("shows the designed message for %s", async (username, message) => {
    renderPage();
    await submitUsername(username);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("connects from a pasted URL, shows progress, then the collection", async () => {
    renderPage();
    await submitUsername("https://bandcamp.com/coolfan");

    expect(await screen.findByText("Importing your collection")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Your collection" }, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText("30 items")).toBeInTheDocument();
    expect(screen.getByText("Connected as coolfan")).toBeInTheDocument();

    const cards = screen.getAllByRole("article");
    const album = cards.find((c) => within(c).queryAllByText("Album").length > 0)!;
    const albumFindSimilar = within(album).getByRole("button", { name: "Find similar" });
    expect(albumFindSimilar).toHaveAttribute("aria-disabled", "true");
    expect(albumFindSimilar).toHaveAccessibleDescription("Albums can't be analyzed yet.");

    const link = within(album).getByRole("link", { name: /on Bandcamp/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const matched = cards.find((c) => within(c).queryByText("In Resomix"))!;
    expect(within(matched).getByRole("button", { name: "Find similar" })).not.toHaveAttribute("aria-disabled");
  });

  it("shows the sync failure with a Retry that recovers", async () => {
    renderPage();
    await submitUsername("syncfail");
    expect(await screen.findByText("Import failed", { selector: "p" }, { timeout: 8000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Your collection" }, { timeout: 8000 })).toBeInTheDocument();
  });

  it("shows the empty-collection state", async () => {
    renderPage();
    await submitUsername("empty");
    expect(await screen.findByText("This collection is empty or has no public items.", {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("disconnects after confirming and returns to the connect form", async () => {
    renderPage();
    await submitUsername("coolfan");
    await screen.findByRole("heading", { name: "Your collection" }, { timeout: 8000 });

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "This removes your imported Bandcamp collection from Resomix. Your Bandcamp account is not affected.",
    );
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus());

    fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    expect(await screen.findByLabelText("Bandcamp username")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens straight onto the collection when already connected", async () => {
    const first = renderPage();
    await submitUsername("coolfan");
    await screen.findByRole("heading", { name: "Your collection" }, { timeout: 8000 });
    first.unmount();

    renderPage();
    expect(await screen.findByRole("heading", { name: "Your collection" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Bandcamp username")).not.toBeInTheDocument();
  });
});
