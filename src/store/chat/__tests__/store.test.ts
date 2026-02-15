import { describe, it, expect, beforeAll, beforeEach, vi, type Mock } from "vitest";
import type { Session } from "../index";

// Mock IPC
vi.mock("@/lib/ipc", () => ({
  ipc: {
    chat: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      isConnected: vi.fn(),
      onStream: vi.fn(() => () => {}),
      onConnected: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
    },
  },
}));

// Avoid hanging vitest runs due to electron-log open handles in renderer logger.
vi.mock("@/lib/logger", () => {
  const noop = () => {};
  return {
    chatLog: { debug: noop, info: noop, warn: noop, error: noop },
  };
});

let useChatStore: typeof import("../index").useChatStore;

const initialState = {
  sessions: [] as Session[],
  currentSessionId: null as string | null,
  loadingMessageIds: [] as string[],
  input: "",
  wsConnected: false,
};

describe("ChatStore", () => {
  beforeAll(async () => {
    ({ useChatStore } = await import("../index"));
  });

  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState(initialState);
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("should create a new session with default name", () => {
      const { createSession } = useChatStore.getState();
      const sessionId = createSession();

      const state = useChatStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe(sessionId);
      expect(state.sessions[0].name).toBe("Session 1");
      expect(state.sessions[0].messages).toEqual([]);
      expect(state.currentSessionId).toBe(sessionId);
    });

    it("should create a new session with custom name", () => {
      const { createSession } = useChatStore.getState();
      const sessionId = createSession("My Chat");

      const state = useChatStore.getState();
      expect(state.sessions[0].name).toBe("My Chat");
      expect(state.currentSessionId).toBe(sessionId);
    });

    it("should increment session name number", () => {
      const { createSession } = useChatStore.getState();
      createSession();
      createSession();
      createSession();

      const state = useChatStore.getState();
      expect(state.sessions).toHaveLength(3);
      expect(state.sessions[0].name).toBe("Session 1");
      expect(state.sessions[1].name).toBe("Session 2");
      expect(state.sessions[2].name).toBe("Session 3");
    });

    it("should set timestamps on creation", () => {
      const { createSession } = useChatStore.getState();
      const before = Date.now();
      createSession();
      const after = Date.now();

      const session = useChatStore.getState().sessions[0];
      expect(session.createdAt).toBeGreaterThanOrEqual(before);
      expect(session.createdAt).toBeLessThanOrEqual(after);
      expect(session.updatedAt).toBe(session.createdAt);
    });

    it("should generate unique key when main session exists with normalized id", () => {
      // Gateway normalizes "main" → "agent:main:main", so hasMain must match both forms
      useChatStore.setState({
        ...initialState,
        sessions: [
          {
            id: "agent:main:main",
            name: "Main",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        currentSessionId: "agent:main:main",
      });

      const { createSession } = useChatStore.getState();
      const newId = createSession();

      expect(newId).not.toBe("main");
      expect(newId).not.toBe("agent:main:main");
      expect(newId).toMatch(/^agent:main:ui:/);
      expect(useChatStore.getState().sessions).toHaveLength(2);
    });
  });

  describe("selectSession", () => {
    it("should select an existing session", () => {
      const { createSession, selectSession } = useChatStore.getState();
      const sessionId1 = createSession("Session A");
      const sessionId2 = createSession("Session B");

      selectSession(sessionId1);
      expect(useChatStore.getState().currentSessionId).toBe(sessionId1);

      selectSession(sessionId2);
      expect(useChatStore.getState().currentSessionId).toBe(sessionId2);
    });

    it("should allow selecting null", () => {
      const { createSession, selectSession } = useChatStore.getState();
      createSession();

      selectSession(null);
      expect(useChatStore.getState().currentSessionId).toBeNull();
    });
  });

  describe("deleteSession", () => {
    it("should delete a session", () => {
      const { createSession, deleteSession } = useChatStore.getState();
      const sessionId = createSession();

      deleteSession(sessionId);
      expect(useChatStore.getState().sessions).toHaveLength(0);
    });

    it("should clear currentSessionId if deleted session was selected", () => {
      const { createSession, deleteSession } = useChatStore.getState();
      const sessionId = createSession();

      expect(useChatStore.getState().currentSessionId).toBe(sessionId);
      deleteSession(sessionId);
      expect(useChatStore.getState().currentSessionId).toBeNull();
    });

    it("should keep currentSessionId if different session was deleted", () => {
      const { createSession, selectSession, deleteSession } = useChatStore.getState();
      const sessionId1 = createSession();
      const sessionId2 = createSession();

      selectSession(sessionId1);
      deleteSession(sessionId2);

      expect(useChatStore.getState().currentSessionId).toBe(sessionId1);
      expect(useChatStore.getState().sessions).toHaveLength(1);
    });
  });

  describe("renameSession", () => {
    it("should rename a session", () => {
      const { createSession, renameSession } = useChatStore.getState();
      const sessionId = createSession("Original Name");

      renameSession(sessionId, "New Name");

      const session = useChatStore.getState().sessions[0];
      expect(session.name).toBe("New Name");
    });

    it("should update updatedAt timestamp", async () => {
      const { createSession, renameSession } = useChatStore.getState();
      const sessionId = createSession();

      const originalUpdatedAt = useChatStore.getState().sessions[0].updatedAt;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 5));

      renameSession(sessionId, "New Name");

      const session = useChatStore.getState().sessions[0];
      expect(session.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe("addMessage", () => {
    it("should add a message to current session", () => {
      const { createSession, addMessage } = useChatStore.getState();
      createSession();

      addMessage({ role: "user", content: "Hello" });

      const session = useChatStore.getState().sessions[0];
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].role).toBe("user");
      expect(session.messages[0].content).toBe("Hello");
      expect(session.messages[0].id).toBeDefined();
      expect(session.messages[0].timestamp).toBeDefined();
    });

    it("should create a new session if none exists", () => {
      const { addMessage } = useChatStore.getState();

      expect(useChatStore.getState().sessions).toHaveLength(0);
      addMessage({ role: "user", content: "Hello" });

      const state = useChatStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].messages).toHaveLength(1);
    });

    it("should update session updatedAt", () => {
      const { createSession, addMessage } = useChatStore.getState();
      createSession();

      const before = Date.now();
      addMessage({ role: "assistant", content: "Hi there!" });
      const after = Date.now();

      const session = useChatStore.getState().sessions[0];
      expect(session.updatedAt).toBeGreaterThanOrEqual(before);
      expect(session.updatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe("updateMessage", () => {
    it("should update message content", () => {
      const { createSession, addMessage, updateMessage } = useChatStore.getState();
      createSession();
      addMessage({ role: "assistant", content: "Initial content" });

      const messageId = useChatStore.getState().sessions[0].messages[0].id;
      updateMessage(messageId, "Updated content");

      const message = useChatStore.getState().sessions[0].messages[0];
      expect(message.content).toBe("Updated content");
    });

    it("should set isStreaming to false", () => {
      const { createSession, addMessage, setMessageStreaming, updateMessage } =
        useChatStore.getState();
      createSession();
      addMessage({ role: "assistant", content: "Streaming...", isStreaming: true });

      const messageId = useChatStore.getState().sessions[0].messages[0].id;
      setMessageStreaming(messageId, true);
      updateMessage(messageId, "Final content");

      const message = useChatStore.getState().sessions[0].messages[0];
      expect(message.isStreaming).toBe(false);
    });
  });

  describe("appendMessageContent", () => {
    it("should append content to existing message", () => {
      const { createSession, addMessage, appendMessageContent } = useChatStore.getState();
      createSession();
      addMessage({ role: "assistant", content: "Hello" });

      const messageId = useChatStore.getState().sessions[0].messages[0].id;
      appendMessageContent(messageId, " World");

      const message = useChatStore.getState().sessions[0].messages[0];
      expect(message.content).toBe("Hello World");
    });
  });

  describe("setMessageStreaming", () => {
    it("should set streaming state", () => {
      const { createSession, addMessage, setMessageStreaming } = useChatStore.getState();
      createSession();
      addMessage({ role: "assistant", content: "" });

      const messageId = useChatStore.getState().sessions[0].messages[0].id;

      setMessageStreaming(messageId, true);
      expect(useChatStore.getState().sessions[0].messages[0].isStreaming).toBe(true);

      setMessageStreaming(messageId, false);
      expect(useChatStore.getState().sessions[0].messages[0].isStreaming).toBe(false);
    });
  });

  describe("setInput", () => {
    it("should update input value", () => {
      const { setInput } = useChatStore.getState();

      setInput("Hello world");
      expect(useChatStore.getState().input).toBe("Hello world");

      setInput("");
      expect(useChatStore.getState().input).toBe("");
    });
  });

  describe("addLoadingMessage / removeLoadingMessage", () => {
    it("should add and remove loading message ids", () => {
      const { addLoadingMessage, removeLoadingMessage } = useChatStore.getState();

      addLoadingMessage("msg_1");
      expect(useChatStore.getState().loadingMessageIds).toEqual(["msg_1"]);

      addLoadingMessage("msg_2");
      expect(useChatStore.getState().loadingMessageIds).toEqual(["msg_1", "msg_2"]);

      removeLoadingMessage("msg_1");
      expect(useChatStore.getState().loadingMessageIds).toEqual(["msg_2"]);

      removeLoadingMessage("msg_2");
      expect(useChatStore.getState().loadingMessageIds).toEqual([]);
    });

    it("should not duplicate ids on repeated add", () => {
      const { addLoadingMessage } = useChatStore.getState();

      addLoadingMessage("msg_1");
      addLoadingMessage("msg_1");
      expect(useChatStore.getState().loadingMessageIds).toEqual(["msg_1"]);
    });
  });

  describe("setWsConnected", () => {
    it("should update WebSocket connection state", () => {
      const { setWsConnected } = useChatStore.getState();

      setWsConnected(true);
      expect(useChatStore.getState().wsConnected).toBe(true);

      setWsConnected(false);
      expect(useChatStore.getState().wsConnected).toBe(false);
    });
  });

  describe("connectWebSocket", () => {
    it("should call ipc.chat.connect", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.chat.connect as Mock).mockResolvedValue(true);

      const { connectWebSocket } = useChatStore.getState();
      await connectWebSocket("ws://localhost:8080");

      expect(ipc.chat.connect).toHaveBeenCalledWith("ws://localhost:8080");
    });

    it("should handle connection error gracefully", async () => {
      const { ipc } = await import("@/lib/ipc");
      const { chatLog } = await import("@/lib/logger");
      const logSpy = vi.spyOn(chatLog, "error").mockImplementation(() => {});
      (ipc.chat.connect as Mock).mockRejectedValue(new Error("Connection failed"));

      const { connectWebSocket } = useChatStore.getState();
      await connectWebSocket();

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("disconnectWebSocket", () => {
    it("should call ipc.chat.disconnect", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.chat.disconnect as Mock).mockResolvedValue(true);

      const { disconnectWebSocket } = useChatStore.getState();
      await disconnectWebSocket();

      expect(ipc.chat.disconnect).toHaveBeenCalled();
    });
  });

  describe("sendMessage", () => {
    it("should add user message and clear input", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.chat.send as Mock).mockImplementation(async (req) => req.messageId ?? "msg_123");

      useChatStore.setState({ wsConnected: true });
      const { createSession, setInput, sendMessage } = useChatStore.getState();
      createSession();
      setInput("Hello");

      await sendMessage("Hello");

      const state = useChatStore.getState();
      expect(state.input).toBe("");
      expect(state.sessions[0].messages[0].role).toBe("user");
      expect(state.sessions[0].messages[0].content).toBe("Hello");
    });

    it("should create assistant placeholder message", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.chat.send as Mock).mockImplementation(async (req) => req.messageId ?? "msg_123");

      useChatStore.setState({ wsConnected: true });
      const { createSession, sendMessage } = useChatStore.getState();
      createSession();

      await sendMessage("Hello");

      const messages = useChatStore.getState().sessions[0].messages;
      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe("assistant");
      expect(messages[1].isStreaming).toBe(true);
      expect(ipc.chat.send).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: messages[1].id,
        }),
      );
    });

    it("should create session if none exists", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.chat.send as Mock).mockImplementation(async (req) => req.messageId ?? "msg_123");

      useChatStore.setState({ wsConnected: true });
      const { sendMessage } = useChatStore.getState();

      await sendMessage("Hello");

      const state = useChatStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.currentSessionId).toBeDefined();
    });

    it("should show fallback message when WebSocket not connected", async () => {
      useChatStore.setState({ wsConnected: false });
      const { createSession, sendMessage } = useChatStore.getState();
      createSession();

      await sendMessage("Hello");

      const messages = useChatStore.getState().sessions[0].messages;
      expect(messages[1].content).toContain("WebSocket not connected");
    });

    it("should handle send error", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.chat.send as Mock).mockRejectedValue(new Error("Send failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      useChatStore.setState({ wsConnected: true });
      const { createSession, sendMessage } = useChatStore.getState();
      createSession();

      await sendMessage("Hello");

      const messages = useChatStore.getState().sessions[0].messages;
      expect(messages[1].content).toContain("Error");
      expect(useChatStore.getState().loadingMessageIds).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe("clearCurrentSession", () => {
    it("should clear messages from current session", () => {
      const { createSession, addMessage, clearCurrentSession } = useChatStore.getState();
      createSession();
      addMessage({ role: "user", content: "Hello" });
      addMessage({ role: "assistant", content: "Hi!" });

      clearCurrentSession();

      const session = useChatStore.getState().sessions[0];
      expect(session.messages).toHaveLength(0);
    });

    it("should update session updatedAt", () => {
      const { createSession, addMessage, clearCurrentSession } = useChatStore.getState();
      createSession();
      addMessage({ role: "user", content: "Hello" });

      const originalUpdatedAt = useChatStore.getState().sessions[0].updatedAt;

      clearCurrentSession();

      const session = useChatStore.getState().sessions[0];
      expect(session.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe("selectors", () => {
    it("selectCurrentSession should return current session", async () => {
      const { selectCurrentSession } = await import("../index");
      const { createSession } = useChatStore.getState();
      createSession("Test Session");

      const currentSession = selectCurrentSession(useChatStore.getState());
      expect(currentSession?.name).toBe("Test Session");
    });

    it("selectCurrentSession should return undefined when no session selected", async () => {
      const { selectCurrentSession } = await import("../index");
      useChatStore.setState({ currentSessionId: null });

      const currentSession = selectCurrentSession(useChatStore.getState());
      expect(currentSession).toBeUndefined();
    });

    it("selectMessages should return current session messages", async () => {
      const { selectMessages } = await import("../index");
      const { createSession, addMessage } = useChatStore.getState();
      createSession();
      addMessage({ role: "user", content: "Hello" });

      const messages = selectMessages(useChatStore.getState());
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Hello");
    });

    it("selectMessages should return empty array when no session", async () => {
      const { selectMessages } = await import("../index");

      const messages = selectMessages(useChatStore.getState());
      expect(messages).toEqual([]);
    });

    it("selectSessions should return all sessions", async () => {
      const { selectSessions } = await import("../index");
      const { createSession } = useChatStore.getState();
      createSession("Session 1");
      createSession("Session 2");

      const sessions = selectSessions(useChatStore.getState());
      expect(sessions).toHaveLength(2);
    });

    it("selectIsLoading should return true when loadingMessageIds is non-empty", async () => {
      const { selectIsLoading } = await import("../index");
      useChatStore.setState({ loadingMessageIds: ["msg_1"] });

      expect(selectIsLoading(useChatStore.getState())).toBe(true);
    });

    it("selectIsLoading should return false when loadingMessageIds is empty", async () => {
      const { selectIsLoading } = await import("../index");
      useChatStore.setState({ loadingMessageIds: [] });

      expect(selectIsLoading(useChatStore.getState())).toBe(false);
    });

    it("selectInput should return input value", async () => {
      const { selectInput } = await import("../index");
      useChatStore.setState({ input: "Test input" });

      expect(selectInput(useChatStore.getState())).toBe("Test input");
    });

    it("selectWsConnected should return connection state", async () => {
      const { selectWsConnected } = await import("../index");
      useChatStore.setState({ wsConnected: true });

      expect(selectWsConnected(useChatStore.getState())).toBe(true);
    });
  });
});
