import { describe, expect, it } from "vitest";
import { classifyUrlId, isCatalogueTrackId, isPlaylistUuid } from "@/utils/urlIdKind.ts";

describe("urlIdKind", () => {
  it("classifies numeric ids as catalogue tracks", () => {
    expect(classifyUrlId("42")).toBe("catalogue-track");
    expect(classifyUrlId("710293")).toBe("catalogue-track");
    expect(isCatalogueTrackId("12345")).toBe(true);
    expect(isPlaylistUuid("12345")).toBe(false);
  });

  it("classifies UUID ids as playlists", () => {
    const uuid = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    expect(classifyUrlId(uuid)).toBe("playlist");
    expect(isPlaylistUuid(uuid)).toBe(true);
    expect(isCatalogueTrackId(uuid)).toBe(false);
  });

  it("returns null for unknown shapes", () => {
    expect(classifyUrlId("trk_71f5e8c0")).toBeNull();
    expect(classifyUrlId("not-a-uuid")).toBeNull();
    expect(classifyUrlId("")).toBeNull();
  });

  it("does not treat a failed playlist UUID as a catalogue track (transient-error case)", () => {
    const failedPlaylistUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    expect(classifyUrlId(failedPlaylistUuid)).toBe("playlist");
    expect(isCatalogueTrackId(failedPlaylistUuid)).toBe(false);
  });
});
