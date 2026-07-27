/** Confidence values are valid only in (0, 1] — outside that range is treated as absent. */
export function isValidConfidence(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1;
}

export function formatConfidence(value: number | null | undefined): string | null {
  return isValidConfidence(value) ? value.toFixed(2) : null;
}

/** Append " · conf X.XX" only when confidence is valid. */
export function withConfidenceSuffix(base: string, confidence: number | null | undefined): string {
  const conf = formatConfidence(confidence);
  return conf ? `${base} · conf ${conf}` : base;
}

export function medianValidConfidence(values: number[]): number | null {
  const valid = values.filter(isValidConfidence).sort((a, b) => a - b);
  if (!valid.length) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
}
