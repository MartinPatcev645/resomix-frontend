import { createHash } from "node:crypto";

/**
 * The internal model and tool names that must never appear anywhere in this repo or on screen.
 *
 * Stored as SHA-256 hashes, so the guard itself does not spell out what it guards. A word is
 * checked by hashing it, which means the comparison is exact: "maestro" and "essential" are
 * different words from the ones listed here and pass.
 *
 * To add a name, add the hash of the lowercase word: `printf %s word | shasum -a 256`.
 */
const FORBIDDEN = new Set([
  "08bf05228f77ee3bf2c2d5d977181d4bbfa83450b5699b4897d508038d643f1b",
  "8ee565bd99a64f9d3629c9ec14fd42942e0390f340acc848712a46797baa8af3",
  "d217d53e3e7e34e5c61dbf785aefde94fede42d827bce3c78216c32b25ecc0f1",
  "3e1ef5ad89b99aa24516ba4c8d4b23363bdd34f56ab63cf557866761d53c6a33",
  "fc8d8cac0de4d906f37690e9cc8f32ff264696b88fe0632b9ffa316b9a227b86",
  "e03d2c41ef2fff7e33b02d58e3f2cce1c0fa8aabc23a7c045ccd024ab577c646",
  "bc27e0904ff0ddfb26aba0299b705cd3e479149b23bb4aa5678ff581c69ab016",
]);

const sha256 = (word: string) => createHash("sha256").update(word).digest("hex");

/**
 * Every forbidden word in `text`, in order of appearance.
 *
 * Words are runs of letters, so a name glued to digits, underscores or a hyphen ("name_top",
 * "name-519", "name400") is still caught.
 */
export function internalNamesIn(text: string): string[] {
  const seen = new Map<string, boolean>();
  const found: string[] = [];
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    let bad = seen.get(word);
    if (bad === undefined) {
      bad = FORBIDDEN.has(sha256(word));
      seen.set(word, bad);
    }
    if (bad) found.push(word);
  }
  return found;
}
