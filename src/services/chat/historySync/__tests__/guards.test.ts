import type { UIMessage } from "ai";
import { describe, it, expect } from "vitest";
import { hasRecentTailOverlap, isLikelyTransientHistoryDrop } from "../guards";

function msg(id: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text: id }] } as UIMessage;
}

describe("hasRecentTailOverlap", () => {
  it("returns true when previous is empty", () => {
    expect(hasRecentTailOverlap([], [msg("a")])).toBe(true);
  });

  it("returns true when tail ids overlap with next", () => {
    const prev = [msg("a"), msg("b"), msg("c")];
    const next = [msg("b"), msg("c"), msg("d")];
    expect(hasRecentTailOverlap(prev, next)).toBe(true);
  });

  it("returns false when no tail ids overlap", () => {
    const prev = [msg("a"), msg("b"), msg("c")];
    const next = [msg("x"), msg("y")];
    expect(hasRecentTailOverlap(prev, next)).toBe(false);
  });

  it("only checks last 3 messages of previous", () => {
    const prev = [msg("a"), msg("b"), msg("c"), msg("d"), msg("e")];
    // "a" is in next but not in tail-3 (c, d, e)
    const next = [msg("a"), msg("x")];
    expect(hasRecentTailOverlap(prev, next)).toBe(false);
  });
});

describe("isLikelyTransientHistoryDrop", () => {
  it("returns false when prev has fewer than 6 messages", () => {
    const prev = Array.from({ length: 5 }, (_, i) => msg(`m${i}`));
    expect(isLikelyTransientHistoryDrop(prev, [msg("x")])).toBe(false);
  });

  it("returns false when next is not smaller than prev", () => {
    const prev = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    const next = Array.from({ length: 10 }, (_, i) => msg(`n${i}`));
    expect(isLikelyTransientHistoryDrop(prev, next)).toBe(false);
  });

  it("returns false when delta is less than 4", () => {
    const prev = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    // 10 - 7 = 3, below threshold
    const next = Array.from({ length: 7 }, (_, i) => msg(`n${i}`));
    expect(isLikelyTransientHistoryDrop(prev, next)).toBe(false);
  });

  it("returns false when ratio exceeds 0.6", () => {
    const prev = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    // 7/10 = 0.7 > 0.6
    const next = Array.from({ length: 7 }, (_, i) => msg(`n${i}`));
    expect(isLikelyTransientHistoryDrop(prev, next)).toBe(false);
  });

  it("returns false when tail overlaps", () => {
    const prev = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    // next has only 2 items, big drop, but tail overlaps
    const next = [msg("x"), msg("m9")];
    expect(isLikelyTransientHistoryDrop(prev, next)).toBe(false);
  });

  it("returns true for 167 -> 2 with no overlap (the reported scenario)", () => {
    const prev = Array.from({ length: 167 }, (_, i) => msg(`m${i}`));
    const next = [msg("new1"), msg("new2")];
    expect(isLikelyTransientHistoryDrop(prev, next)).toBe(true);
  });

  it("returns true when next is empty", () => {
    const prev = Array.from({ length: 10 }, (_, i) => msg(`m${i}`));
    expect(isLikelyTransientHistoryDrop(prev, [])).toBe(true);
  });
});
