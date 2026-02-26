import { describe, expect, it } from "vitest";
import { classifySession, classifySessionKey, extractAgentId } from "../sessionKey";

describe("extractAgentId", () => {
  it("extracts agent id from ACP session key", () => {
    expect(extractAgentId("agent:codex:acp:uuid-123")).toBe("codex");
  });

  it("returns 'main' for non-agent keys", () => {
    expect(extractAgentId("acp:uuid-123")).toBe("main");
  });
});

describe("classifySessionKey", () => {
  // ACP sessions
  it("classifies agent-prefixed ACP key", () => {
    expect(classifySessionKey("agent:main:acp:uuid-123")).toEqual({
      source: "acp",
      hidden: false,
    });
  });

  it("classifies bare ACP key (no agent prefix)", () => {
    expect(classifySessionKey("acp:uuid-123")).toEqual({
      source: "acp",
      hidden: false,
    });
  });

  // Regression: existing types unchanged
  it("classifies ui session", () => {
    expect(classifySessionKey("agent:main:ui:abc")).toEqual({ source: "ui", hidden: false });
  });

  it("classifies discord session", () => {
    expect(classifySessionKey("discord:abc")).toEqual({ source: "discord", hidden: false });
  });

  it("classifies telegram session", () => {
    expect(classifySessionKey("agent:bot:telegram:abc")).toEqual({
      source: "telegram",
      hidden: false,
    });
  });

  it("classifies cron session", () => {
    expect(classifySessionKey("cron:daily")).toEqual({ source: "cron", hidden: false });
  });

  it("hides clawui meta sessions", () => {
    expect(classifySessionKey("clawui:meta:abc")).toEqual({ source: "unknown", hidden: true });
  });

  it("hides subagent sessions", () => {
    expect(classifySessionKey("agent:main:subagent:abc")).toEqual({
      source: "unknown",
      hidden: true,
    });
  });

  it("returns unknown for empty string", () => {
    expect(classifySessionKey("")).toEqual({ source: "unknown", hidden: false });
  });
});

describe("classifySession", () => {
  it("prefers surface over sessionKey", () => {
    expect(classifySession({ sessionKey: "acp:uuid", surface: "discord" })).toEqual({
      source: "discord",
      hidden: false,
    });
  });

  it("falls back to sessionKey when surface is null", () => {
    expect(classifySession({ sessionKey: "acp:uuid", surface: null })).toEqual({
      source: "acp",
      hidden: false,
    });
  });
});
