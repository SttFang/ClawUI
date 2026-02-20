import { describe, expect, it } from "vitest";
import { compareOpenClawVersions, MIN_OPENCLAW_VERSION } from "../version";

describe("compareOpenClawVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareOpenClawVersions("2026.2.9", "2026.2.9")).toBe(0);
  });

  it("compares major (year) correctly", () => {
    expect(compareOpenClawVersions("2027.1.1", "2026.12.31")).toBe(1);
    expect(compareOpenClawVersions("2025.1.1", "2026.1.1")).toBe(-1);
  });

  it("compares minor (month) correctly", () => {
    expect(compareOpenClawVersions("2026.3.1", "2026.2.9")).toBe(1);
    expect(compareOpenClawVersions("2026.1.1", "2026.2.1")).toBe(-1);
  });

  it("compares patch (day) correctly", () => {
    expect(compareOpenClawVersions("2026.2.19", "2026.2.9")).toBe(1);
    expect(compareOpenClawVersions("2026.2.1", "2026.2.9")).toBe(-1);
  });

  it("handles -patch suffix", () => {
    expect(compareOpenClawVersions("2026.2.9-2", "2026.2.9")).toBe(1);
    expect(compareOpenClawVersions("2026.2.9-1", "2026.2.9-2")).toBe(-1);
    expect(compareOpenClawVersions("2026.2.9-3", "2026.2.9-3")).toBe(0);
  });

  it("newer version beats patch of older version", () => {
    expect(compareOpenClawVersions("2026.2.10", "2026.2.9-5")).toBe(1);
  });

  it("MIN_OPENCLAW_VERSION is a valid version string", () => {
    expect(compareOpenClawVersions(MIN_OPENCLAW_VERSION, MIN_OPENCLAW_VERSION)).toBe(0);
  });
});
