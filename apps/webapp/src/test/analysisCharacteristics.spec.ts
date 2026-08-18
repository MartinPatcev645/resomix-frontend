/**
 * "Instrumental 0.09" told the reader the opposite of the truth.
 *
 * The analysis service produces ONE number for this axis, and it is the probability of **voice**:
 *
 *     sem.voice_score = voice_classes.get("voice")
 *     sem.voice_instrumental = "voice" if (sem.voice_score or 0.0) >= 0.5 else "instrumental"
 *
 * The card printed that raw score under whichever label came back. So the real track that prompted
 * this — `voice_instrumental: "instrumental"`, `voice_score: 0.0944` — rendered as
 * "Instrumental 0.09". It is 91% instrumental. The word and the number contradicted each other, and
 * the number is the one a reader trusts.
 *
 * The redesign made it worse before it made it better: the new tile puts a definition under the
 * value ("Instrumental presence"), which turns an ambiguous number into a confident false claim.
 * Hence these tests.
 */
import { describe, expect, it } from "vitest";
import { buildCharacteristics } from "@/utils/analysisCharacteristics.ts";

const tile = (input: Parameters<typeof buildCharacteristics>[0], key: string) =>
  buildCharacteristics(input).find((t) => t.key === key);

describe("the instrumental / vocal tile", () => {
  it("reports how instrumental the track is, not how vocal", () => {
    // The exact payload from the reported track.
    const t = tile({ voiceInstrumental: "instrumental", voiceScore: 0.0944 }, "voice");

    expect(t?.label).toBe("Instrumental");
    expect(t?.value).toBe("0.91"); // pre-fix this read "0.09"
    expect(t?.definition).toBe("Instrumental presence");
  });

  it("leaves a vocal track's score alone", () => {
    // Here the raw score already IS the probability of the label, so it must not be inverted.
    const t = tile({ voiceInstrumental: "voice", voiceScore: 0.83 }, "voice");

    expect(t?.label).toBe("Vocal");
    expect(t?.value).toBe("0.83");
    expect(t?.definition).toBe("Vocal presence");
  });

  it("keeps the number on the same side as the label at the 0.5 boundary", () => {
    // The service switches label at >= 0.5. Whichever side it lands, the printed value must be the
    // probability of the printed word — never below 0.5, or the tile contradicts itself again.
    for (const voiceScore of [0.49, 0.5, 0.51]) {
      const instrumental = voiceScore < 0.5;
      const t = tile(
        { voiceInstrumental: instrumental ? "instrumental" : "voice", voiceScore },
        "voice",
      );
      expect(Number(t?.value), `voice_score ${voiceScore}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("shows a dash rather than inventing a value when the score is missing", () => {
    const t = tile({ voiceInstrumental: "instrumental", voiceScore: null }, "voice");
    expect(t?.value).toBe("—");
    expect(t?.label).toBe("Instrumental");
  });

  it("omits the tile entirely when the service returned no verdict", () => {
    expect(tile({ voiceScore: 0.2 }, "voice")).toBeUndefined();
  });
});

describe("the other characteristic tiles", () => {
  it("keeps a genuine zero", () => {
    // `if (sem.arousal)` used to drop the tile for a track that scored exactly 0, which is a
    // reading, not a missing value.
    const tiles = buildCharacteristics({ arousal: 0, valence: 0, danceability: 0 });
    expect(tiles.map((t) => t.value)).toEqual(["0.00", "0.00", "0.00"]);
  });

  it("drops only what is genuinely absent", () => {
    const tiles = buildCharacteristics({ arousal: 0.58, danceability: 0.9988 });
    expect(tiles.map((t) => t.key)).toEqual(["arousal", "danceability"]);
  });

  it("renders the four tiles in the designed order, with definitions", () => {
    const tiles = buildCharacteristics({
      arousal: 0.5796,
      valence: 0.6268,
      danceability: 0.9988,
      voiceInstrumental: "instrumental",
      voiceScore: 0.0944,
    });

    expect(tiles.map((t) => t.key)).toEqual(["arousal", "valence", "danceability", "voice"]);
    expect(tiles.map((t) => t.value)).toEqual(["0.58", "0.63", "1.00", "0.91"]);
    for (const t of tiles) expect(t.definition.trim()).not.toBe("");
  });

  it("does not include energy", () => {
    // Dropped on purpose: the energy graph directly above shows it over time, which is more than a
    // single averaged number can say. Re-adding it here would also push the row to five tiles and
    // break the 4-across / 2×2 grid.
    const tiles = buildCharacteristics({ arousal: 0.5, valence: 0.5, danceability: 0.5 });
    expect(tiles.some((t) => t.key === "energy" || /energy/i.test(t.label))).toBe(false);
  });
});
