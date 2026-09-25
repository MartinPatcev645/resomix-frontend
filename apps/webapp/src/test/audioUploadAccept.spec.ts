import { describe, expect, it } from "vitest";
import { AUDIO_INPUT_ACCEPT, isProbablyAudio, validateAudioFile } from "@resomix/api-client";

/**
 * What the browser is allowed to refuse.
 *
 * The client used to check the file's MIME type against a list of twelve, which rejected an iPhone
 * voice memo (`audio/x-m4a` in Safari, `audio/mp4` in Chrome) and a WhatsApp note (named `.mpeg`,
 * often no type at all) before either left the browser. The server probes the real streams,
 * refuses anything that is not audio and converts what it cannot process directly, so the only
 * thing worth deciding here is size and the obvious mistake of picking a photo.
 */
const file = (name: string, type: string, size = 1024): File =>
  ({ name, type, size }) as unknown as File;

describe("what the upload picker accepts", () => {
  it("takes a phone recording, whatever the browser calls it", () => {
    for (const type of ["audio/x-m4a", "audio/mp4", "audio/aac", "audio/ogg; codecs=opus"]) {
      expect(isProbablyAudio(file("recording.m4a", type)), type).toBe(true);
    }
  });

  it("takes a file the browser cannot type at all, by its extension", () => {
    for (const name of ["note.opus", "voice.amr", "memo.caf", "track.wma", "whatsapp.mpeg"]) {
      expect(isProbablyAudio(file(name, "")), name).toBe(true);
    }
  });

  it("still refuses what is plainly not audio", () => {
    expect(isProbablyAudio(file("scan.pdf", "application/pdf"))).toBe(false);
    expect(isProbablyAudio(file("cover.jpg", "image/jpeg"))).toBe(false);
    expect(isProbablyAudio(file("clip.mp4", "video/mp4"))).toBe(false);
    expect(isProbablyAudio(file("notes.txt", ""))).toBe(false);
  });

  it("keeps size as the one hard client-side limit", () => {
    const tooBig = file("long.m4a", "audio/mp4", 101 * 1024 * 1024);
    expect(validateAudioFile(tooBig).valid).toBe(false);
    expect(validateAudioFile(tooBig).error).toContain("too large");
    expect(validateAudioFile(file("fine.m4a", "audio/mp4")).valid).toBe(true);
  });

  it("offers the wildcard AND the extensions in the picker", () => {
    // Phones honour `audio/*`; some desktop pickers ignore it and would grey out a valid .m4a.
    expect(AUDIO_INPUT_ACCEPT.startsWith("audio/*")).toBe(true);
    for (const ext of [".m4a", ".opus", ".wma", ".amr", ".caf", ".flac", ".aiff"]) {
      expect(AUDIO_INPUT_ACCEPT, ext).toContain(ext);
    }
    // A video container is never offered: the server refuses video.
    expect(AUDIO_INPUT_ACCEPT).not.toContain(".mp4,");
  });
});
