import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatContextValue } from "../ChatContext";
import { ChatProvider } from "../ChatProvider";
import { useChatFeature } from "../useChatFeature";

const {
  ensureChatConnectedMock,
  ipcRequestMock,
  navigateMock,
  refreshSessionsMock,
  selectSessionMock,
  localDeleteSessionMock,
  generateMetadataMock,
  onDismissBannerMock,
} = vi.hoisted(() => ({
  ensureChatConnectedMock: vi.fn(() => Promise.resolve()),
  ipcRequestMock: vi.fn(() => Promise.resolve({ ok: true })),
  navigateMock: vi.fn(),
  refreshSessionsMock: vi.fn(() => Promise.resolve()),
  selectSessionMock: vi.fn(),
  localDeleteSessionMock: vi.fn(),
  generateMetadataMock: vi.fn(),
  onDismissBannerMock: vi.fn(),
}));

const { chatState, gatewayState } = vi.hoisted(() => ({
  chatState: {
    sessions: [
      {
        id: "agent:main:main",
        name: "Main",
        messages: [],
        createdAt: 1,
        updatedAt: 1,
        surface: null,
      },
    ],
    currentSessionId: "agent:main:main",
    wsConnected: false,
    refreshSessions: refreshSessionsMock,
    selectSession: selectSessionMock,
    deleteSession: localDeleteSessionMock,
  },
  gatewayState: {
    isGatewayRunning: true,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    chat: {
      request: ipcRequestMock,
      send: vi.fn(() => Promise.resolve()),
    },
  },
}));

vi.mock("@/services/chat/connection", () => ({
  ensureChatConnected: ensureChatConnectedMock,
}));

vi.mock("@/store/chat", () => ({
  useChatStore: <T>(selector: (state: typeof chatState) => T) => selector(chatState),
  selectCurrentSession: (state: typeof chatState) =>
    state.sessions.find((session) => session.id === state.currentSessionId),
  selectSessions: (state: typeof chatState) => state.sessions,
}));

vi.mock("@/store/gateway", () => ({
  useGatewayStore: <T>(selector: (state: typeof gatewayState) => T) => selector(gatewayState),
  selectIsGatewayRunning: (state: typeof gatewayState) => state.isGatewayRunning,
}));

vi.mock("../hooks/useConfigValidation", () => ({
  useConfigValidation: () => ({
    configValid: true,
    showBanner: false,
    onDismissBanner: onDismissBannerMock,
  }),
}));

vi.mock("../hooks/useSessionMetadata", () => ({
  useSessionMetadata: () => ({
    sessionMetadata: {},
    metaBusyByKey: {},
    generateMetadata: generateMetadataMock,
  }),
}));

describe("ChatProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatState.sessions = [
      {
        id: "agent:main:main",
        name: "Main",
        messages: [],
        createdAt: 1,
        updatedAt: 1,
        surface: null,
      },
    ];
    chatState.currentSessionId = "agent:main:main";
    chatState.wsConnected = false;
  });

  it("deletes session via gateway instead of local-only store mutation", async () => {
    const holder: { value: ChatContextValue | null } = { value: null };
    const Probe = () => {
      holder.value = useChatFeature();
      return null;
    };

    renderToStaticMarkup(createElement(ChatProvider, null, createElement(Probe)));

    holder.value?.sessionActions.onDeleteSession("agent:main:main");
    await Promise.resolve();
    await Promise.resolve();

    expect(ensureChatConnectedMock).toHaveBeenCalledTimes(1);
    expect(ipcRequestMock).toHaveBeenCalledWith("sessions.delete", {
      key: "agent:main:main",
      deleteTranscript: false,
    });
    expect(refreshSessionsMock).toHaveBeenCalledTimes(1);
    expect(localDeleteSessionMock).not.toHaveBeenCalled();
  });
});
