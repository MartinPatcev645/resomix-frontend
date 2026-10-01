/**
 * No internal model or tool name anywhere in this repo.
 *
 * Not in code, comments, tests, fixtures, styles or docs. The words themselves live only as hashes
 * in `internalNames.ts`. Everything the browser receives comes from Alwyzon, which renames them
 * on the way out, so nothing in this repo has a reason to spell one.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { internalNamesIn } from "./internalNames.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Build output, dependencies and local-only folders. None of it is committed. */
const SKIP_DIRS = new Set([
  "node_modules", "dist", "dist-ssr", "coverage", "test-results", "playwright-report", "x_assets",
]);

/** Dot-folders are caches and tool state (.git, .turbo, .pnpm-store), except CI config. */
const skipDir = (name: string) => SKIP_DIRS.has(name) || (name.startsWith(".") && name !== ".github");

const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".md", ".mdx",
  ".html", ".yml", ".yaml", ".txt", ".svg", ".toml", ".example", "",
]);

function* textFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (!skipDir(name)) yield* textFiles(path);
    } else if (TEXT_EXT.has(extname(name)) && stat.size < 5_000_000) yield path;
  }
}

describe("internal names", () => {
  it("appear in no file in the repo", () => {
    const offenders: string[] = [];
    for (const file of textFiles(ROOT)) {
      const found = internalNamesIn(readFileSync(file, "utf8"));
      if (found.length) offenders.push(`${relative(ROOT, file)} (${found.length})`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("are recognised however they are glued to other characters", () => {
    // Built from pieces so this file does not contain the word it is testing for.
    const word = ["ma", "est"].join("");
    expect(internalNamesIn(`style_${word}_top`)).toHaveLength(1);
    expect(internalNamesIn(`${word.toUpperCase()}-519`)).toHaveLength(1);
  });

  it("leave ordinary words alone", () => {
    expect(internalNamesIn("Maestro · Essential House · Discotheque")).toEqual([]);
  });
});
