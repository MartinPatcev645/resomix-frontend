/**
 * The four "Track characteristics" tiles under the structure list.
 *
 * Pure, so the one genuinely subtle rule here — the instrumental/vocal inversion — can be tested
 * without rendering the analysis page.
 */

export interface CharacteristicTile {
  key: string;
  label: string;
  /** Already formatted to 2dp, or "—" when the reading is missing. */
  value: string;
  /** One-line definition shown under the number. Descriptive, never interpretive. */
  definition: string;
}

export interface CharacteristicsInput {
  arousal?: number | null;
  valence?: number | null;
  danceability?: number | null;
  /** "instrumental" | "voice", as decided by the analysis service. */
  voiceInstrumental?: string | null;
  /** Probability of VOICE. See the note in `buildCharacteristics`. */
  voiceScore?: number | null;
}

export function buildCharacteristics(sem: CharacteristicsInput): CharacteristicTile[] {
  const tiles: CharacteristicTile[] = [];

  // `typeof x === "number"` rather than truthiness: a genuine 0 is a reading, and the previous
  // `if (sem.arousal)` dropped the tile for any track that scored exactly zero.
  if (typeof sem.arousal === "number")
    tiles.push({ key: "arousal", label: "Arousal", value: sem.arousal.toFixed(2), definition: "Perceived activation" });
  if (typeof sem.valence === "number")
    tiles.push({ key: "valence", label: "Valence", value: sem.valence.toFixed(2), definition: "Emotional tone" });
  if (typeof sem.danceability === "number")
    tiles.push({
      key: "danceability",
      label: "Danceability",
      value: sem.danceability.toFixed(2),
      definition: "Rhythmic suitability",
    });

  if (sem.voiceInstrumental) {
    // `voice_score` is the probability of VOICE. The analysis service derives the label from it:
    //
    //     sem.voice_score = voice_classes.get("voice")
    //     sem.voice_instrumental = "voice" if (sem.voice_score or 0.0) >= 0.5 else "instrumental"
    //
    // We used to print that raw score beneath whichever label came back, so a track scoring 0.09
    // for vocals — i.e. 91% instrumental — was displayed as "Instrumental 0.09". The number said
    // 9% instrumental while the word beside it said instrumental: the reader was told the exact
    // opposite of the finding.
    //
    // Show the probability OF THE LABEL BEING PRINTED, so the two can never disagree again.
    const instrumental = sem.voiceInstrumental === "instrumental";
    const score = typeof sem.voiceScore === "number" ? (instrumental ? 1 - sem.voiceScore : sem.voiceScore) : null;
    tiles.push({
      key: "voice",
      label: instrumental ? "Instrumental" : "Vocal",
      value: score == null ? "—" : score.toFixed(2),
      definition: instrumental ? "Instrumental presence" : "Vocal presence",
    });
  }

  return tiles;
}
