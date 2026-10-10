import { BANDCAMP_COPY } from "../bandcampCopy.ts";
import type { BandcampErrorKind } from "../api/types.ts";

type ErrorCopyKind = keyof typeof BANDCAMP_COPY.errors;

export function errorCopyFor(kind: BandcampErrorKind) {
  const key: ErrorCopyKind = kind in BANDCAMP_COPY.errors ? (kind as ErrorCopyKind) : "unknown";
  return BANDCAMP_COPY.errors[key];
}
