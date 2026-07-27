import { describe, expect, it } from "vitest";
import {
  formatConfidence,
  isValidConfidence,
  medianValidConfidence,
  withConfidenceSuffix,
} from "@/utils/analysisConfidence.ts";

describe("analysisConfidence", () => {
  it("treats values outside (0, 1] as invalid", () => {
    expect(isValidConfidence(-0.04)).toBe(false);
    expect(isValidConfidence(0)).toBe(false);
    expect(isValidConfidence(1.01)).toBe(false);
    expect(isValidConfidence(0.94)).toBe(true);
  });

  it("omits confidence segment when invalid", () => {
    expect(withConfidenceSuffix("117.9 BPM", -0.04)).toBe("117.9 BPM");
    expect(withConfidenceSuffix("BPM", 0.94)).toBe("BPM · conf 0.94");
  });

  it("formats valid confidence to two decimals", () => {
    expect(formatConfidence(0.9)).toBe("0.90");
  });

  it("computes median over valid confidences only", () => {
    expect(medianValidConfidence([0.9, -0.1, 0.7, 0.5])).toBeCloseTo(0.7);
  });
});
