/**
 * The brand faces, inlined for the capture.
 *
 * A page is photographed by drawing it inside an SVG `foreignObject`, and that runs in a context
 * with no access to the document's fonts: whatever is not carried in with the markup falls back to
 * a system face, which is how an export of a page set in Helvetica Neue and Fira Code comes out in
 * Times. html-to-image can inline every `@font-face` it finds, but the app ships 56 of them (1.7MB
 * across two scripts and five families) and it would re-read and re-encode the lot for every page.
 *
 * So this builds the small set the document actually uses, once, and hands it over. If a fetch
 * fails the export still runs and the text falls back, which is better than no PDF at all.
 */

interface Face {
  family: string;
  weight: number;
  url: string;
}

/**
 * Latin only. The document is our own copy, and the analysis it prints is filenames, note names,
 * genre labels and numbers — the extended ranges buy nothing for a sizable chunk of the payload.
 */
const FACES: Face[] = [
  { family: "Helvetica_Neue", weight: 300, url: "/fonts/HelveticaNeueLight.latin.woff2" },
  { family: "Helvetica_Neue", weight: 400, url: "/fonts/HelveticaNeueRoman.latin.woff2" },
  { family: "Helvetica_Neue", weight: 500, url: "/fonts/HelveticaNeueMedium.latin.woff2" },
  { family: "Helvetica_Neue", weight: 700, url: "/fonts/HelveticaNeueBold.latin.woff2" },
  { family: "Fira Code", weight: 400, url: "/fonts/FiraCode-Regular.latin.woff2" },
  { family: "Fira Code", weight: 500, url: "/fonts/FiraCode-Medium.latin.woff2" },
  { family: "Fira Code", weight: 600, url: "/fonts/FiraCode-SemiBold.latin.woff2" },
];

let cached: Promise<string> | null = null;

async function dataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return `data:font/woff2;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/** `@font-face` rules with the fonts embedded, memoised for the session. */
export function analysisExportFontCss(): Promise<string> {
  if (!cached) {
    cached = Promise.all(
      FACES.map(async (face) => {
        const src = await dataUrl(face.url);
        if (!src) return "";
        return `@font-face{font-family:'${face.family}';src:url(${src}) format('woff2');font-weight:${face.weight};font-style:normal;font-display:block;}`;
      }),
    )
      .then((rules) => rules.join(""))
      .catch(() => "");
  }
  return cached;
}
