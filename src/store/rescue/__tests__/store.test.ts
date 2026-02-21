import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatStreamEvent, GatewayStatus } from "@/lib/ipc";

const mocks = vi.hoisted(() => ({
  gatewayStart: vi.fn<() => Promise<void>>(),
  gatewayStop: vi.fn<() => Promise<void>>(),
  gatewayGetStatus: vi.fn<() => Promise<GatewayStatus>>(),
  gatewayOnStatusChange: vi.fn<(cb: (s: GatewayStatus) => void) => () => void>(),
  chatConnect: vi.fn<() => Promise<boolean>>(),
  chatSend: vi.fn<() => Promise<string>>(),
  chatOnStream: vi.fn<(cb: (e: ChatStreamEvent) => void) => () => void>(),
  chatOnConnected: vi.fn<(cb: () => void) => () => void>(),
  chatOnDisconnected: vi.fn<(cb: () => void) => () => void>(),
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    rescue: {
      gateway: {
        start: mocks.gatewayStart,
        stop: mocks.gatewayStop,
        getStatus: mocks.gatewayGetStatus,
        onStatusChange: mocks.gatewayOnStatusChange,
      },
      chat: {
        connect: mocks.chatConnect,
        send: mocks.chatSend,
        onStream: mocks.chatOnStream,
        onConnected: mocks.chatOnConnected,
        onDisconnected: mocks.chatOnDisconnected,
      },
    },
  },
}));

// Must import after vi.mock
const { useRescueStore, initRescueListener } = await import("../index");

const initialState = {
  gatewayStatus: "stopped" as const,
  wsConnected: false,
  messages: [],
  input: "",
  isOpen: false,
  sessionId: "rescue",
};

describe("RescueStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRescueStore.setState(initialState);
  });

  // ── handleStreamEvent ──────────────────────────────────────────

  describe("handleStreamEvent", () => {
    const baseEvent: ChatStreamEvent = {
      type: "delta",
      sessionId: "rescue",
      messageId: "run-1",
      content: "Hello",
    };

    it("should create a new assistant message on first delta", () => {
      useRescueStore.getState().handleStreamEvent(baseEvent);

      const msgs = useRescueStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({
        id: "run-1:a",
        role: "assistant",
        content: "Hello",
        isStreaming: true,
      });
    });

    it("should REPLACE content on subsequent delta (not append)", () => {
      const { handleStreamEvent } = useRescueStore.getState();
      handleStreamEvent({ ...baseEvent, content: "He" });
      handleStreamEvent({ ...baseEvent, content: "Hello world" });

      const msgs = useRescueStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe("Hello world");
    });

    it("should set isStreaming=false on end event", () => {
      const { handleStreamEvent } = useRescueStore.getState();
      handleStreamEvent(baseEvent);
      handleStreamEvent({ ...baseEvent, type: "end" });

      const msgs = useRescueStore.getState().messages;
      expect(msgs[0].isStreaming).toBe(false);
    });

    it("should append error text to existing assistant message", () => {
      const { handleStreamEvent } = useRescueStore.getState();
      handleStreamEvent({ ...baseEvent, content: "partial" });
      handleStreamEvent({ ...baseEvent, type: "error", error: "timeout" });

      const msgs = useRescueStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe("partial\n[error: timeout]");
      expect(msgs[0].isStreaming).toBe(false);
    });

    it("should create a new error message when no assistant exists", () => {
      useRescueStore.getState().handleStreamEvent({
        ...baseEvent,
        type: "error",
        error: "connection lost",
      });

      const msgs = useRescueStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe("[error: connection lost]");
      expect(msgs[0].role).toBe("assistant");
    });

    it("should default to 'unknown' when error field is undefined", () => {
      useRescueStore.getState().handleStreamEvent({
        ...baseEvent,
        type: "error",
        error: undefined,
      });

      const msgs = useRescueStore.getState().messages;
      expect(msgs[0].content).toBe("[error: unknown]");
    });

    it("should ignore end event when no assistant message exists", () => {
      useRescueStore.getState().handleStreamEvent({ ...baseEvent, type: "end" });

      expect(useRescueStore.getState().messages).toHaveLength(0);
    });
  });

  // ── sendMessage ────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("should add a user message and clear input", async () => {
      mocks.chatSend.mockResolvedValue("ok");
      useRescueStore.setState({ input: "draft text" });

      await useRescueStore.getState().sendMessage("hi");

      const state = useRescueStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toMatchObject({ role: "user", content: "hi" });
      expect(state.input).toBe("");
    });

    it("should call ipc.rescue.chat.send with correct payload", async () => {
      mocks.chatSend.mockResolvedValue("ok");

      await useRescueStore.getState().sendMessage("test");

      expect(mocks.chatSend).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "rescue",
          message: "test",
        }),
      );
    });

    it("should still add user message even if send throws", async () => {
      mocks.chatSend.mockRejectedValue(new Error("network"));

      await useRescueStore.getState().sendMessage("oops");

      expect(useRescueStore.getState().messages).toHaveLength(1);
      expect(useRescueStore.getState().messages[0].role).toBe("user");
    });
  });

  // ── startGateway ───────────────────────────────────────────────

  describe("startGateway", () => {
    it("should transition to 'starting' then to actual status", async () => {
      mocks.gatewayStart.mockResolvedValue(undefined);
      mocks.gatewayGetStatus.mockResolvedValue("running");

      const promise = useRescueStore.getState().startGateway();
      expect(useRescueStore.getState().gatewayStatus).toBe("starting");

      await promise;
      expect(useRescueStore.getState().gatewayStatus).toBe("running");
    });

    it("should set status to 'error' when start fails", async () => {
      mocks.gatewayStart.mockRejectedValue(new Error("fail"));

      await useRescueStore.getState().startGateway();

      expect(useRescueStore.getState().gatewayStatus).toBe("error");
    });
  });

  // ── stopGateway ────────────────────────────────────────────────

  describe("stopGateway", () => {
    it("should set status to 'stopped' on success", async () => {
      mocks.gatewayStop.mockResolvedValue(undefined);
      useRescueStore.setState({ gatewayStatus: "running" });

      await useRescueStore.getState().stopGateway();

      expect(useRescueStore.getState().gatewayStatus).toBe("stopped");
    });

    it("should silently swallow errors (best-effort)", async () => {
      mocks.gatewayStop.mockRejectedValue(new Error("fail"));
      useRescueStore.setState({ gatewayStatus: "running" });

      await useRescueStore.getState().stopGateway();

      // status unchanged — error is swallowed
      expect(useRescueStore.getState().gatewayStatus).toBe("running");
    });
  });

  // ── initRescueListener ────────────────────────────────────────

  describe("initRescueListener", () => {
    // Reset the module-level flag between tests
    beforeEach(async () => {
      // Re-import to get a fresh module scope is not practical,
      // so we test idempotency by calling twice in one test.
      vi.clearAllMocks();
    });

    it("should register IPC listeners", () => {
      mocks.gatewayOnStatusChange.mockReturnValue(() => {});
      mocks.chatOnStream.mockReturnValue(() => {});
      mocks.chatOnConnected.mockReturnValue(() => {});
      mocks.chatOnDisconnected.mockReturnValue(() => {});
      mocks.gatewayGetStatus.mockResolvedValue("stopped");

      initRescueListener();

      expect(mocks.gatewayOnStatusChange).toHaveBeenCalledWith(expect.any(Function));
      expect(mocks.chatOnStream).toHaveBeenCalledWith(expect.any(Function));
      expect(mocks.chatOnConnected).toHaveBeenCalledWith(expect.any(Function));
      expect(mocks.chatOnDisconnected).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should be idempotent (only initializes once)", () => {
      mocks.gatewayOnStatusChange.mockReturnValue(() => {});
      mocks.chatOnStream.mockReturnValue(() => {});
      mocks.chatOnConnected.mockReturnValue(() => {});
      mocks.chatOnDisconnected.mockReturnValue(() => {});
      mocks.gatewayGetStatus.mockResolvedValue("stopped");

      initRescueListener();
      initRescueListener();

      // onStatusChange should only be called from the first invocation
      // (the flag was already set from the previous test, so these
      // calls come from the first call in *this* test at most)
      const totalCalls = mocks.gatewayOnStatusChange.mock.calls.length;
      expect(totalCalls).toBeLessThanOrEqual(1);
    });
  });

  // ── selectors / simple setters ─────────────────────────────────

  describe("simple setters", () => {
    it("setInput updates input", () => {
      useRescueStore.getState().setInput("hello");
      expect(useRescueStore.getState().input).toBe("hello");
    });

    it("open / close / toggle", () => {
      useRescueStore.getState().open();
      expect(useRescueStore.getState().isOpen).toBe(true);

      useRescueStore.getState().close();
      expect(useRescueStore.getState().isOpen).toBe(false);

      useRescueStore.getState().toggle();
      expect(useRescueStore.getState().isOpen).toBe(true);
    });

    it("setGatewayStatus / setWsConnected", () => {
      useRescueStore.getState().setGatewayStatus("running");
      expect(useRescueStore.getState().gatewayStatus).toBe("running");

      useRescueStore.getState().setWsConnected(true);
      expect(useRescueStore.getState().wsConnected).toBe(true);
    });
  });
});
