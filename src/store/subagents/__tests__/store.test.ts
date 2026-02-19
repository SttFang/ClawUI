import type { ChatNormalizedRunEvent } from "@clawui/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock ipc before importing store
vi.mock("@/lib/ipc", () => ({
  ipc: {
    chat: {
      onNormalizedEvent: vi.fn(() => () => {}),
      request: vi.fn(() => Promise.resolve({ ok: true })),
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  chatLog: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { parseSpawnResult } from "../listener";
import { selectNodeList, selectActiveCount, selectAllDone, selectHistory } from "../selectors";
import { useSubagentsStore } from "../store";

function resetStore() {
  useSubagentsStore.getState().reset();
}

describe("subagents store", () => {
  beforeEach(resetStore);

  it("add inserts a node and opens panel", () => {
    useSubagentsStore.getState().add({
      runId: "r1",
      sessionKey: "child:s1",
      parentSessionKey: "parent:s1",
      task: "do stuff",
      status: "running",
      createdAt: 1000,
    });

    const state = useSubagentsStore.getState();
    expect(state.nodes["r1"]).toBeDefined();
    expect(state.nodes["r1"].task).toBe("do stuff");
    expect(state.panelOpen).toBe(true);
  });

  it("updateStatus transitions and sets endedAt for terminal", () => {
    useSubagentsStore.getState().add({
      runId: "r1",
      sessionKey: "child:s1",
      parentSessionKey: "parent:s1",
      task: "task",
      status: "running",
      createdAt: 1000,
    });

    useSubagentsStore.getState().updateStatus("r1", "done");
    const node = useSubagentsStore.getState().nodes["r1"];
    expect(node.status).toBe("done");
    expect(node.endedAt).toBeGreaterThan(0);
  });

  it("remove cleans up node and history", () => {
    useSubagentsStore.getState().add({
      runId: "r1",
      sessionKey: "child:s1",
      parentSessionKey: "parent:s1",
      task: "task",
      status: "running",
      createdAt: 1000,
    });
    useSubagentsStore.getState().setHistory("r1", [{ role: "user", content: "hi" }]);
    useSubagentsStore.getState().select("r1");

    useSubagentsStore.getState().remove("r1");
    const state = useSubagentsStore.getState();
    expect(state.nodes["r1"]).toBeUndefined();
    expect(state.historyByRunId["r1"]).toBeUndefined();
    expect(state.selectedRunId).toBeNull();
  });

  it("select and togglePanel work", () => {
    useSubagentsStore.getState().select("r1");
    expect(useSubagentsStore.getState().selectedRunId).toBe("r1");

    useSubagentsStore.getState().togglePanel(true);
    expect(useSubagentsStore.getState().panelOpen).toBe(true);

    useSubagentsStore.getState().togglePanel();
    expect(useSubagentsStore.getState().panelOpen).toBe(false);
  });
});

describe("subagents selectors", () => {
  beforeEach(resetStore);

  it("selectNodeList returns sorted by createdAt", () => {
    const { add } = useSubagentsStore.getState();
    add({
      runId: "r2",
      sessionKey: "s2",
      parentSessionKey: "p",
      task: "b",
      status: "running",
      createdAt: 2000,
    });
    add({
      runId: "r1",
      sessionKey: "s1",
      parentSessionKey: "p",
      task: "a",
      status: "done",
      createdAt: 1000,
    });

    const list = selectNodeList(useSubagentsStore.getState());
    expect(list[0].runId).toBe("r1");
    expect(list[1].runId).toBe("r2");
  });

  it("selectActiveCount counts running/spawning", () => {
    const { add } = useSubagentsStore.getState();
    add({
      runId: "r1",
      sessionKey: "s1",
      parentSessionKey: "p",
      task: "a",
      status: "running",
      createdAt: 1000,
    });
    add({
      runId: "r2",
      sessionKey: "s2",
      parentSessionKey: "p",
      task: "b",
      status: "done",
      createdAt: 2000,
    });
    add({
      runId: "r3",
      sessionKey: "s3",
      parentSessionKey: "p",
      task: "c",
      status: "spawning",
      createdAt: 3000,
    });

    expect(selectActiveCount(useSubagentsStore.getState())).toBe(2);
  });

  it("selectAllDone returns true when all terminal", () => {
    const { add } = useSubagentsStore.getState();
    add({
      runId: "r1",
      sessionKey: "s1",
      parentSessionKey: "p",
      task: "a",
      status: "done",
      createdAt: 1000,
    });
    add({
      runId: "r2",
      sessionKey: "s2",
      parentSessionKey: "p",
      task: "b",
      status: "error",
      createdAt: 2000,
    });

    expect(selectAllDone(useSubagentsStore.getState())).toBe(true);
  });

  it("selectHistory returns empty for unknown runId", () => {
    expect(selectHistory(useSubagentsStore.getState(), "unknown")).toEqual([]);
  });
});

describe("parseSpawnResult", () => {
  it("parses valid sessions_spawn tool_finished event", () => {
    const event: ChatNormalizedRunEvent = {
      kind: "run.tool_finished",
      traceId: "t1",
      timestampMs: 5000,
      sessionKey: "parent:s1",
      clientRunId: "cr1",
      metadata: {
        name: "sessions_spawn",
        args: { prompt: "do research", model: "gpt-4" },
        result: { sessionKey: "child:s1", runId: "run-123" },
      },
    };

    const node = parseSpawnResult(event);
    expect(node).not.toBeNull();
    expect(node!.runId).toBe("run-123");
    expect(node!.sessionKey).toBe("child:s1");
    expect(node!.parentSessionKey).toBe("parent:s1");
    expect(node!.task).toBe("do research");
    expect(node!.model).toBe("gpt-4");
    expect(node!.status).toBe("running");
  });

  it("returns null for non-spawn tool", () => {
    const event: ChatNormalizedRunEvent = {
      kind: "run.tool_finished",
      traceId: "t1",
      timestampMs: 5000,
      sessionKey: "parent:s1",
      clientRunId: "cr1",
      metadata: { name: "exec", result: {} },
    };
    expect(parseSpawnResult(event)).toBeNull();
  });

  it("returns null when result lacks sessionKey", () => {
    const event: ChatNormalizedRunEvent = {
      kind: "run.tool_finished",
      traceId: "t1",
      timestampMs: 5000,
      sessionKey: "parent:s1",
      clientRunId: "cr1",
      metadata: {
        name: "sessions_spawn",
        result: { runId: "r1" },
      },
    };
    expect(parseSpawnResult(event)).toBeNull();
  });
});
