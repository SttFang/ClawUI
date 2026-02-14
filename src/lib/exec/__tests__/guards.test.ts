import { describe, it, expect } from "vitest";
import { isExecToolName, isReadToolName } from "../guards";

describe("isExecToolName", () => {
  it.each(["exec", "Exec", "EXEC", "bash", "Bash", "BASH", " exec ", " bash "])(
    "returns true for %j",
    (name) => {
      expect(isExecToolName(name)).toBe(true);
    },
  );

  it.each(["read", "write", "edit", "", "execute", "sh"])("returns false for %j", (name) => {
    expect(isExecToolName(name)).toBe(false);
  });
});

describe("isReadToolName", () => {
  it.each(["read", "Read", "READ", " read "])("returns true for %j", (name) => {
    expect(isReadToolName(name)).toBe(true);
  });

  it.each(["exec", "write", "", "reading"])("returns false for %j", (name) => {
    expect(isReadToolName(name)).toBe(false);
  });
});
