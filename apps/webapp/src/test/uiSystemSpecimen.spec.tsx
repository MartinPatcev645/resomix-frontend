import { render, screen } from "@testing-library/react";
import UiSystemSpecimenPage from "@/pages/UiSystemSpecimenPage.tsx";

describe("UiSystemSpecimenPage", () => {
  it("renders the internal specimen heading and product modes", () => {
    render(<UiSystemSpecimenPage />);

    expect(screen.getByRole("heading", { name: "Resomix UI System" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Find Similar Tracks/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Analyse a Track/i })).toBeInTheDocument();
    expect(screen.getByText("[RX_UI / PHASE_1B]")).toBeInTheDocument();
  });

  it("marks the page as internal and noindex", () => {
    render(<UiSystemSpecimenPage />);

    expect(screen.getByText("Route is internal")).toBeInTheDocument();
    expect(document.title).toBe("Resomix UI System Specimen");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  });

  it("groups result rows in channel-strip containers", () => {
    const { container } = render(<UiSystemSpecimenPage />);
    expect(container.querySelectorAll(".rx-channel").length).toBeGreaterThanOrEqual(2);
  });
});
