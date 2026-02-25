import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ipc } from "@/lib/ipc";
import { ensureChatConnected } from "@/services/chat/connection";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { useChatStore, selectCurrentSession, selectSessions } from "@/store/chat";
import { isMainSessionKey, MAIN_SESSION_KEY } from "@/store/chat/helpers";
import { useGatewayStore, selectIsGatewayRunning } from "@/store/gateway";
import type { SessionListItem } from "./types";
import { ChatContext, type ChatContextValue } from "./ChatContext";
import { useConfigValidation } from "./hooks/useConfigValidation";
import { useSessionMetadata } from "./hooks/useSessionMetadata";
import { classifySession } from "./utils/sessionKey";
import { extractAgentId } from "./utils/sessionKey";

export function ChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const sessions = useChatStore(selectSessions);
  const currentSession = useChatStore(selectCurrentSession);
  const wsConnected = useChatStore((s) => s.wsConnected);
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning);

  const refreshSessions = useChatStore((s) => s.refreshSessions);
  const selectSession = useChatStore((s) => s.selectSession);

  const { configValid, showBanner, onDismissBanner } = useConfigValidation();
  const { sessionMetadata, metaBusyByKey, generateMetadata } = useSessionMetadata();

  const renameSession = useCallback(
    async (key: string, label: string) => {
      await ensureChatConnected();
      await ipc.chat.request("sessions.patch", { key, label: label.trim() ? label.trim() : null });
      await refreshSessions();
    },
    [refreshSessions],
  );

  const selectedAgentId = useAgentsStore(agentsSelectors.selectSelectedAgentId);
  const prevAgentIdRef = useRef(selectedAgentId);
  const lastSessionByAgent = useRef(new Map<string, string>());

  const visibleSessions: SessionListItem[] = useMemo(() => {
    return sessions
      .filter((s) => {
        const { hidden } = classifySession({ sessionKey: s.id, surface: s.surface });
        if (hidden) return false;
        return extractAgentId(s.id) === selectedAgentId;
      })
      .map((s) => ({ id: s.id, name: s.name, updatedAt: s.updatedAt, surface: s.surface }));
  }, [sessions, selectedAgentId]);

  // Save/restore active session per agent tab
  useEffect(() => {
    const prev = prevAgentIdRef.current;
    if (prev !== selectedAgentId) {
      // Save current session for the agent we're leaving
      const currentId = currentSession?.id;
      if (currentId) lastSessionByAgent.current.set(prev, currentId);
      prevAgentIdRef.current = selectedAgentId;

      // Restore saved session for the agent we're entering
      const saved = lastSessionByAgent.current.get(selectedAgentId);
      if (saved && visibleSessions.some((s) => s.id === saved)) {
        selectSession(saved);
        return;
      }
    }

    // Fallback: if current session not in visible list, pick first or clear
    const currentId = currentSession?.id;
    if (!currentId || !visibleSessions.some((s) => s.id === currentId)) {
      const fallback = visibleSessions[0]?.id ?? null;
      selectSession(fallback);
    }
  }, [currentSession?.id, visibleSessions, selectSession, selectedAgentId]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!wsConnected) return;
    void refreshSessions();
  }, [wsConnected, refreshSessions]);

  const createGatewayUiSession = useCallback(async (): Promise<string> => {
    const sessions = useChatStore.getState().sessions;
    const agentId = useAgentsStore.getState().selectedAgentId ?? "main";
    const hasMain = sessions.some((s) => isMainSessionKey(s.id));
    let key: string;
    if (!hasMain && agentId === "main") {
      key = MAIN_SESSION_KEY;
    } else {
      const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
      const uuid = cryptoObj?.randomUUID
        ? cryptoObj.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      key = `agent:${agentId}:ui:${uuid}`;
    }

    await ensureChatConnected();

    await ipc.chat.request("sessions.reset", { key });
    await refreshSessions();
    selectSession(key);
    return key;
  }, [refreshSessions, selectSession]);

  const startConversation = useCallback(async () => {
    return await createGatewayUiSession();
  }, [createGatewayUiSession]);

  const onCreateSession = useCallback(() => {
    void createGatewayUiSession().catch(() => {});
  }, [createGatewayUiSession]);

  const onSelectSession = useCallback(
    (id: string) => {
      lastSessionByAgent.current.set(selectedAgentId, id);
      selectSession(id);
    },
    [selectSession, selectedAgentId],
  );

  const onRenameSession = useCallback(
    (id: string, label: string) => void renameSession(id, label).catch(() => {}),
    [renameSession],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await ensureChatConnected();
      await ipc.chat.request("sessions.delete", { key: id, deleteTranscript: false });
      await refreshSessions();
    },
    [refreshSessions],
  );

  const onDeleteSession = useCallback(
    (id: string) => void deleteSession(id).catch(() => {}),
    [deleteSession],
  );

  const onOneClickConfig = useCallback(() => navigate("/settings?tab=ai"), [navigate]);
  const onManualConfig = useCallback(() => navigate("/settings?tab=ai"), [navigate]);

  const value: ChatContextValue = useMemo(
    () => ({
      sessionState: {
        sessions: visibleSessions,
        currentSessionId: currentSession?.id ?? null,
        sessionMetadata,
        metaBusyByKey,
      },
      sessionActions: {
        onCreateSession,
        onSelectSession,
        onRenameSession,
        onDeleteSession,
        onGenerateMetadata: generateMetadata,
      },
      uiState: {
        wsConnected,
        isGatewayRunning,
        configValid,
        showBanner,
      },
      uiActions: {
        onDismissBanner,
        onOneClickConfig,
        onManualConfig,
        onStartConversation: startConversation,
      },
    }),
    [
      visibleSessions,
      currentSession?.id,
      sessionMetadata,
      metaBusyByKey,
      onCreateSession,
      onSelectSession,
      onRenameSession,
      onDeleteSession,
      generateMetadata,
      wsConnected,
      isGatewayRunning,
      configValid,
      showBanner,
      onDismissBanner,
      onOneClickConfig,
      onManualConfig,
      startConversation,
    ],
  );

  return <ChatContext value={value}>{children}</ChatContext>;
}
