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

import { parseSpawnResult, findSpawnResultInHistory } from "../listener";
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

  it("resolveSpawn replaces temp key with real runId", () => {
    useSubagentsStore.getState().add({
      runId: "temp-tc1",
      sessionKey: "",
      parentSessionKey: "parent:s1",
      task: "research",
      status: "spawning",
      createdAt: 1000,
    });
    useSubagentsStore.getState().select("temp-tc1");
    useSubagentsStore.getState().resolveSpawn("temp-tc1", "real-run-1", "child:s1");

    const state = useSubagentsStore.getState();
    expect(state.nodes["temp-tc1"]).toBeUndefined();
    expect(state.nodes["real-run-1"]).toBeDefined();
    expect(state.nodes["real-run-1"].sessionKey).toBe("child:s1");
    expect(state.nodes["real-run-1"].status).toBe("running");
    expect(state.selectedRunId).toBe("real-run-1");
  });

  it("resolveSpawn is no-op for unknown temp key", () => {
    useSubagentsStore.getState().resolveSpawn("nonexistent", "r1", "s1");
    expect(Object.keys(useSubagentsStore.getState().nodes)).toHaveLength(0);
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
  it("parses wrapped jsonResult format (verboseLevel=full)", () => {
    const event: ChatNormalizedRunEvent = {
      kind: "run.tool_finished",
      traceId: "t1",
      timestampMs: 5000,
      sessionKey: "parent:s1",
      clientRunId: "cr1",
      metadata: {
        name: "sessions_spawn",
        args: { task: "do research", model: "gpt-4" },
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "accepted",
                childSessionKey: "child:s1",
                runId: "run-123",
              }),
            },
          ],
        },
      },
    };
    const node = parseSpawnResult(event);
    expect(node).not.toBeNull();
    expect(node!.runId).toBe("run-123");
    expect(node!.sessionKey).toBe("child:s1");
    expect(node!.task).toBe("do research");
    expect(node!.model).toBe("gpt-4");
  });

  it("parses direct object result", () => {
    const event: ChatNormalizedRunEvent = {
      kind: "run.tool_finished",
      traceId: "t1",
      timestampMs: 5000,
      sessionKey: "parent:s1",
      clientRunId: "cr1",
      metadata: {
        name: "sessions_spawn",
        result: { status: "accepted", childSessionKey: "child:s1", runId: "run-456" },
      },
    };
    const node = parseSpawnResult(event);
    expect(node).not.toBeNull();
    expect(node!.runId).toBe("run-456");
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

  it("returns null when result is missing (gateway strips it)", () => {
    const event: ChatNormalizedRunEvent = {
      kind: "run.tool_finished",
      traceId: "t1",
      timestampMs: 5000,
      sessionKey: "parent:s1",
      clientRunId: "cr1",
      metadata: { name: "sessions_spawn" },
    };
    expect(parseSpawnResult(event)).toBeNull();
  });

  it("falls back to label when task is absent", () => {
    const event: ChatNormalizedRunEvent = {
      kind: "run.tool_finished",
      traceId: "t1",
      timestampMs: 5000,
      sessionKey: "parent:s1",
      clientRunId: "cr1",
      metadata: {
        name: "sessions_spawn",
        args: { label: "game-check" },
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "accepted", childSessionKey: "c:1", runId: "r1" }),
            },
          ],
        },
      },
    };
    const node = parseSpawnResult(event);
    expect(node!.task).toBe("game-check");
    expect(node!.label).toBe("game-check");
  });
});

describe("findSpawnResultInHistory", () => {
  it("finds tool_result matching toolCallId", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "call_abc", name: "sessions_spawn", input: { task: "research" } },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_abc",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "accepted",
                  childSessionKey: "agent:main:subagent:xyz",
                  runId: "run-789",
                }),
              },
            ],
          },
        ],
      },
    ];
    const found = findSpawnResultInHistory(messages, "call_abc");
    expect(found).not.toBeNull();
    expect(found!.childSessionKey).toBe("agent:main:subagent:xyz");
    expect(found!.runId).toBe("run-789");
  });

  it("returns null when toolCallId does not match", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_other",
            content: [
              { type: "text", text: JSON.stringify({ childSessionKey: "s1", runId: "r1" }) },
            ],
          },
        ],
      },
    ];
    expect(findSpawnResultInHistory(messages, "call_abc")).toBeNull();
  });

  it("returns null for empty messages", () => {
    expect(findSpawnResultInHistory([], "call_abc")).toBeNull();
  });

  it("matches by base ID when toolCallId has |fc_ suffix", () => {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_abc",
            content: [
              {
                type: "text",
                text: JSON.stringify({ childSessionKey: "child:s2", runId: "run-999" }),
              },
            ],
          },
        ],
      },
    ];
    const found = findSpawnResultInHistory(messages, "call_abc|fc_0123456789abcdef");
    expect(found).not.toBeNull();
    expect(found!.childSessionKey).toBe("child:s2");
    expect(found!.runId).toBe("run-999");
  });

  it("finds OpenClaw transcript format (role: toolResult, details)", () => {
    const messages = [
      {
        role: "toolResult",
        toolCallId: "call_abc|fc_0123456789abcdef",
        toolName: "sessions_spawn",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "accepted",
              childSessionKey: "agent:main:subagent:uuid1",
              runId: "run-oc-1",
            }),
          },
        ],
        details: {
          status: "accepted",
          childSessionKey: "agent:main:subagent:uuid1",
          runId: "run-oc-1",
        },
        isError: false,
      },
    ];
    const found = findSpawnResultInHistory(messages, "call_abc|fc_0123456789abcdef");
    expect(found).not.toBeNull();
    expect(found!.childSessionKey).toBe("agent:main:subagent:uuid1");
    expect(found!.runId).toBe("run-oc-1");
  });

  it("matches OpenClaw toolResult by base ID", () => {
    const messages = [
      {
        role: "toolResult",
        toolCallId: "call_xyz|fc_aaa",
        content: [{ type: "text", text: JSON.stringify({ childSessionKey: "c:2", runId: "r2" }) }],
      },
    ];
    // Event toolCallId might differ in fc_ suffix
    const found = findSpawnResultInHistory(messages, "call_xyz|fc_bbb");
    expect(found).not.toBeNull();
    expect(found!.childSessionKey).toBe("c:2");
  });
});
