import { describe, expect, it } from "vitest";
import { MSG } from "../src/shared/compare-protocol.js";

/** Expected message types — update when adding new cross-boundary messages. */
const EXPECTED_KEYS = [
  "SEARCH",
  "RESULT",
  "URL_UPDATE",
  "NAVIGATE",
  "NAVIGATE_RESULT",
  "PASTE_FILES",
  "PASTE_RESULT",
  "EXTRACT",
  "EXTRACT_RESULT",
];

describe("compare-protocol MSG", () => {
  it("exports all expected message keys", () => {
    expect(Object.keys(MSG).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it("uses unique QSHOT_ prefixed string values", () => {
    const values = Object.values(MSG);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(value).toMatch(/^QSHOT_[A-Z_]+$/);
    }
  });
});
