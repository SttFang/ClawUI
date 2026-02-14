import { describe, it, expect } from "vitest";
import { getCommandFromInput } from "../commandParsing";

describe("getCommandFromInput", () => {
  it("extracts command from a plain object", () => {
    expect(getCommandFromInput({ command: "ls -la" })).toBe("ls -la");
  });

  it("trims whitespace", () => {
    expect(getCommandFromInput({ command: "  echo hello  " })).toBe("echo hello");
  });

  it("returns empty string for non-object input", () => {
    expect(getCommandFromInput(null)).toBe("");
    expect(getCommandFromInput("string")).toBe("");
    expect(getCommandFromInput(42)).toBe("");
  });

  it("returns empty string when command is not a string", () => {
    expect(getCommandFromInput({ command: 123 })).toBe("");
    expect(getCommandFromInput({})).toBe("");
  });
});
