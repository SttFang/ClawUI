import { describe, expect, it } from "vitest";
import type { ExecLifecycleRecord } from "@/store/execLifecycle/types";
import {
  createTerminalRecord,
  isLikelyToolReceiptText,
  mapStatusToDecision,
  mapStatusToPartState,
  parseSystemTerminalText,
  parseSystemTs,
  parseToolCallTimestamp,
} from "../systemTextParsing";

describe("parseSystemTs", () => {
  it("parses GMT+8 timestamp", () => {
    const ms = parseSystemTs("[2026-02-14 16:34:03 GMT+8]");
    expect(ms).toBeGreaterThan(0);
    const d = new Date(ms);
    expect(d.getUTCHours()).toBe(8); // 16 - 8 = 8 UTC
  });

  it("parses GMT-5 timestamp", () => {
    const ms = parseSystemTs("[2026-01-01 12:00:00 GMT-5]");
    expect(ms).toBeGreaterThan(0);
    const d = new Date(ms);
    expect(d.getUTCHours()).toBe(17); // 12 + 5 = 17 UTC
  });

  it("returns 0 for invalid input", () => {
    expect(parseSystemTs("no timestamp here")).toBe(0);
    expect(parseSystemTs("")).toBe(0);
  });
});

describe("parseSystemTerminalText", () => {
  it("parses finished with gateway id and command", () => {
    const text =
      "System: [2026-02-14 16:34:03 GMT+8] Exec finished (gateway id=0c8c1be9-908a-4b60-add8-0c6ac01eb9bc, session=ember-cloud, code 0): ls -la";
    const result = parseSystemTerminalText(text);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("completed");
    expect(result!.gatewayId).toBe("0c8c1be9-908a-4b60-add8-0c6ac01eb9bc");
    expect(result!.command).toBe("ls -la");
    expect(result!.atMs).toBeGreaterThan(0);
  });

  it("parses denied with approval-timeout", () => {
    const text = "System: Exec denied (gateway id=abc12345-0000, approval-timeout)";
    const result = parseSystemTerminalText(text);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("timeout");
  });

  it("parses denied without timeout", () => {
    const text = "System: Exec denied (gateway id=abc12345-0000)";
    const result = parseSystemTerminalText(text);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("denied");
  });

  it("parses failed", () => {
    const text = "System: Exec failed (gateway id=abc12345-0000): npm run build";
    const result = parseSystemTerminalText(text);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("error");
    expect(result!.command).toBe("npm run build");
  });

  it("returns null for non-system text", () => {
    expect(parseSystemTerminalText("Hello world")).toBeNull();
    expect(parseSystemTerminalText("")).toBeNull();
  });

  it("requires System: at start of text", () => {
    const text = "Some prefix System: Exec finished (gateway id=abc-123)";
    expect(parseSystemTerminalText(text)).toBeNull();
  });

  it("extracts approvalId from first segment of gateway id", () => {
    const text = "System: Exec finished (gateway id=abc12345-908a-4b60-add8-0c6ac01eb9bc)";
    const result = parseSystemTerminalText(text);
    expect(result!.approvalId).toBe("abc12345");
  });
});

describe("isLikelyToolReceiptText", () => {
  it("matches System: prefixed text", () => {
    expect(isLikelyToolReceiptText("System: Exec finished ...")).toBe(true);
  });

  it("matches approval patterns", () => {
    expect(isLikelyToolReceiptText("Approval required for exec")).toBe(true);
    expect(isLikelyToolReceiptText("Approve to run this command")).toBe(true);
  });

  it("matches structured tool JSON", () => {
    expect(isLikelyToolReceiptText('{"status":"ok","tool":"exec"}')).toBe(true);
  });

  it("rejects normal user text", () => {
    expect(isLikelyToolReceiptText("I want to run a command")).toBe(false);
    expect(isLikelyToolReceiptText("The system is working fine")).toBe(false);
  });

  it("rejects text with system: in the middle", () => {
    expect(isLikelyToolReceiptText("The operating system: Ubuntu 22.04")).toBe(false);
  });

  it("rejects empty text", () => {
    expect(isLikelyToolReceiptText("")).toBe(false);
    expect(isLikelyToolReceiptText("   ")).toBe(false);
  });
});

describe("parseToolCallTimestamp", () => {
  it("extracts timestamp from assistant-format ID", () => {
    const ts = parseToolCallTimestamp("assistant:1771000000000:r1:tool-1");
    expect(ts).toBe(1771000000000);
  });

  it("extracts timestamp from generic colon-separated ID", () => {
    const ts = parseToolCallTimestamp("prefix:1771000000000:suffix");
    expect(ts).toBe(1771000000000);
  });

  it("returns 0 for IDs without timestamps", () => {
    expect(parseToolCallTimestamp("call_abc123")).toBe(0);
    expect(parseToolCallTimestamp("")).toBe(0);
  });
});

describe("mapStatusToPartState", () => {
  it("maps completed to output-available", () => {
    expect(mapStatusToPartState("completed")).toBe("output-available");
  });

  it("maps non-completed to output-error", () => {
    expect(mapStatusToPartState("denied")).toBe("output-error");
    expect(mapStatusToPartState("error")).toBe("output-error");
    expect(mapStatusToPartState("timeout")).toBe("output-error");
  });
});

describe("mapStatusToDecision", () => {
  it("maps denied → deny", () => {
    expect(mapStatusToDecision("denied")).toBe("deny");
  });

  it("maps timeout → timeout", () => {
    expect(mapStatusToDecision("timeout")).toBe("timeout");
  });

  it("returns undefined for other statuses", () => {
    expect(mapStatusToDecision("completed")).toBeUndefined();
    expect(mapStatusToDecision("running")).toBeUndefined();
  });
});

describe("createTerminalRecord", () => {
  const baseRecord: ExecLifecycleRecord = {
    attemptId: "attempt-1",
    lifecycleKey: "key-1",
    runId: "run-1",
    sessionKey: "session-1",
    command: "ls -la",
    normalizedCommand: "ls -la",
    status: "running",
    toolCallId: "tool-1",
    toolName: "exec",
    messageId: "msg-1",
    partIndex: 0,
    partState: "input-available",
    preliminary: true,
    startedAtMs: 1000,
    updatedAtMs: 2000,
    sourceToolCallIds: ["tool-1"],
  };

  it("updates status and clears preliminary flag", () => {
    const result = createTerminalRecord(baseRecord, {
      status: "completed",
      atMs: 3000,
    });
    expect(result.status).toBe("completed");
    expect(result.preliminary).toBe(false);
    expect(result.endedAtMs).toBe(3000);
  });

  it("preserves base command when terminal has none", () => {
    const result = createTerminalRecord(baseRecord, {
      status: "completed",
      atMs: 3000,
    });
    expect(result.command).toBe("ls -la");
  });

  it("fills command from terminal when base is empty", () => {
    const emptyCommand = { ...baseRecord, command: "", normalizedCommand: "" };
    const result = createTerminalRecord(emptyCommand, {
      status: "completed",
      command: "echo hello",
      atMs: 3000,
    });
    expect(result.command).toBe("echo hello");
  });
});
