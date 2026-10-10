import { describe, expect, it } from "vitest";
import { parseBandcampUsername } from "@/features/bandcamp/lib/parseUsername.ts";

describe("parseBandcampUsername", () => {
  it.each([
    ["coolfan", "coolfan"],
    ["  coolfan  ", "coolfan"],
    ["@coolfan", "coolfan"],
    ["Cool_Fan-99", "Cool_Fan-99"],
    ["bandcamp.com/coolfan", "coolfan"],
    ["www.bandcamp.com/coolfan", "coolfan"],
    ["https://bandcamp.com/coolfan", "coolfan"],
    ["http://bandcamp.com/coolfan/", "coolfan"],
    ["https://BANDCAMP.com/coolfan?from=menubar#wishlist", "coolfan"],
    ["https://www.bandcamp.com/coolfan", "coolfan"],
  ])("accepts %j", (input, username) => {
    expect(parseBandcampUsername(input)).toEqual({ ok: true, username });
  });

  it.each(["", "   "])("reports empty input %j", (input) => {
    expect(parseBandcampUsername(input)).toEqual({ ok: false, reason: "empty" });
  });

  it.each([
    "artist.bandcamp.com",
    "https://artist.bandcamp.com",
    "https://artist.bandcamp.com/album/some-record",
    "label.bandcamp.com/music",
  ])("rejects the artist page %j before calling the API", (input) => {
    expect(parseBandcampUsername(input)).toEqual({ ok: false, reason: "artist_url" });
  });

  it.each([
    "https://example.com/coolfan",
    "https://bandcamp.com/",
    "https://bandcamp.com/coolfan/wishlist",
    "bandcamp.com",
    "cool fan",
    "cool/fan",
    "ftp://bandcamp.com/coolfan",
    "a".repeat(65),
    "name!",
  ])("rejects the malformed input %j", (input) => {
    expect(parseBandcampUsername(input)).toEqual({ ok: false, reason: "invalid" });
  });
});
