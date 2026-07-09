/**
 * makePlayableUrl — return an object URL the <audio> element can actually play.
 *
 * Most uploads (mp3/mpeg, wav, flac, ogg, m4a) play natively. AIFF does NOT play
 * in Chrome via <audio>, so for anything the browser can't play natively we
 * decode it with the Web Audio API and re-wrap it as a WAV blob (which every
 * browser plays). Keeps the <audio>-based transport (seek / volume) working for
 * every supported format.
 */

const EXT_MIME: Record<string, string> = {
  mp3: "audio/mpeg", mpeg: "audio/mpeg", mpg: "audio/mpeg",
  m4a: "audio/mp4", aac: "audio/aac",
  wav: "audio/wav", wave: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg", oga: "audio/ogg",
  aif: "audio/aiff", aiff: "audio/aiff", aifc: "audio/aiff",
};

function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "";
}

function nativelyPlayable(file: File): boolean {
  const mime = mimeOf(file).split(";")[0];
  if (!mime) return false;
  // AIFF is the one we always transcode (Chrome <audio> can't decode it).
  if (mime === "audio/aiff" || mime === "audio/x-aiff") return false;
  return document.createElement("audio").canPlayType(mime) !== "";
}

export async function makePlayableUrl(file: File): Promise<string> {
  if (nativelyPlayable(file)) return URL.createObjectURL(file);
  try {
    const buf = await file.arrayBuffer();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const audioBuffer = await ctx.decodeAudioData(buf);
    void ctx.close();
    return URL.createObjectURL(new Blob([audioBufferToWav(audioBuffer)], { type: "audio/wav" }));
  } catch {
    // Last resort — hand the raw file to <audio> and let it try.
    return URL.createObjectURL(file);
  }
}

/** Encode an AudioBuffer as a 16-bit PCM WAV. */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const blockAlign = numCh * 2; // 16-bit
  const dataLength = numFrames * blockAlign;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);              // PCM header size
  view.setUint16(20, 1, true);               // format = PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);              // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return ab;
}
