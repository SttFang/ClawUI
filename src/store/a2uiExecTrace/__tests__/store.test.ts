import { beforeEach, describe, expect, it } from "vitest";
import { useA2UIExecTraceStore } from "../store";

describe("A2UI exec trace store", () => {
  beforeEach(() => {
    useA2UIExecTraceStore.setState({
      tracesByKey: {},
      terminalByCommand: {},
    });
  });

  it("stores trace and terminal records", () => {
    const store = useA2UIExecTraceStore.getState();
    store.setTrace({
      traceKey: "agent:main:ui:1::tool-1",
      sessionKey: "agent:main:ui:1",
      toolCallId: "tool-1",
      toolOrder: 1,
      command: "ls -la ~/Desktop",
      status: "running",
      startedAtMs: 1,
    });
    store.setTerminal("agent:main:ui:1::ls -la ~/Desktop", {
      traceKey: "agent:main:ui:1::tool-1",
      endedAtMs: 2,
      toolOrder: 1,
    });

    const next = useA2UIExecTraceStore.getState();
    expect(next.tracesByKey["agent:main:ui:1::tool-1"]?.command).toBe("ls -la ~/Desktop");
    expect(next.terminalByCommand["agent:main:ui:1::ls -la ~/Desktop"]?.traceKey).toBe(
      "agent:main:ui:1::tool-1",
    );
  });

  it("clears only one session namespace", () => {
    const store = useA2UIExecTraceStore.getState();
    store.setTrace({
      traceKey: "agent:main:ui:1::tool-1",
      sessionKey: "agent:main:ui:1",
      toolCallId: "tool-1",
      toolOrder: 1,
      command: "ls -la ~/Desktop",
      status: "running",
      startedAtMs: 1,
    });
    store.setTrace({
      traceKey: "agent:main:ui:2::tool-2",
      sessionKey: "agent:main:ui:2",
      toolCallId: "tool-2",
      toolOrder: 2,
      command: "pwd",
      status: "running",
      startedAtMs: 2,
    });
    store.setTerminal("agent:main:ui:1::ls -la ~/Desktop", {
      traceKey: "agent:main:ui:1::tool-1",
      endedAtMs: 3,
      toolOrder: 1,
    });
    store.setTerminal("agent:main:ui:2::pwd", {
      traceKey: "agent:main:ui:2::tool-2",
      endedAtMs: 4,
      toolOrder: 2,
    });

    store.clearSession("agent:main:ui:1");

    const next = useA2UIExecTraceStore.getState();
    expect(next.tracesByKey["agent:main:ui:1::tool-1"]).toBeUndefined();
    expect(next.terminalByCommand["agent:main:ui:1::ls -la ~/Desktop"]).toBeUndefined();
    expect(next.tracesByKey["agent:main:ui:2::tool-2"]).toBeDefined();
    expect(next.terminalByCommand["agent:main:ui:2::pwd"]).toBeDefined();
  });
});
