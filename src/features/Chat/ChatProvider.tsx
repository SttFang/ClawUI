import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ipc } from "@/lib/ipc";
import { ensureChatConnected } from "@/services/chat/connection";
import { useChatStore, selectCurrentSession, selectSessions } from "@/store/chat";
import { MAIN_SESSION_KEY } from "@/store/chat/helpers";
import { useGatewayStore, selectIsGatewayRunning } from "@/store/gateway";
import type { SessionListItem } from "./types";
import { ChatContext, type ChatContextValue } from "./ChatContext";
import { useConfigValidation } from "./hooks/useConfigValidation";
import { useSessionMetadata } from "./hooks/useSessionMetadata";
import { classifySession } from "./utils/sessionKey";

export function ChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const sessions = useChatStore(selectSessions);
  const currentSession = useChatStore(selectCurrentSession);
  const wsConnected = useChatStore((s) => s.wsConnected);
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning);

  const refreshSessions = useChatStore((s) => s.refreshSessions);
  const selectSession = useChatStore((s) => s.selectSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

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

  const visibleSessions: SessionListItem[] = useMemo(() => {
    return sessions
      .filter((s) => {
        const { hidden } = classifySession({ sessionKey: s.id, surface: s.surface });
        return !hidden;
      })
      .map((s) => ({ id: s.id, name: s.name, updatedAt: s.updatedAt, surface: s.surface }));
  }, [sessions]);

  useEffect(() => {
    const currentId = currentSession?.id;
    if (!currentId) return;
    if (visibleSessions.some((s) => s.id === currentId)) return;
    const fallback = visibleSessions[0]?.id;
    if (fallback) selectSession(fallback);
  }, [currentSession?.id, visibleSessions, selectSession]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!wsConnected) return;
    void refreshSessions();
  }, [wsConnected, refreshSessions]);

  const createGatewayUiSession = useCallback(async (): Promise<string> => {
    const sessions = useChatStore.getState().sessions;
    const hasMain = sessions.some((s) => s.id === MAIN_SESSION_KEY);
    let key: string;
    if (!hasMain) {
      key = MAIN_SESSION_KEY;
    } else {
      const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
      const uuid = cryptoObj?.randomUUID
        ? cryptoObj.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      key = `agent:main:ui:${uuid}`;
    }

    await ensureChatConnected();

    await ipc.chat.request("sessions.reset", { key });
    await refreshSessions();
    selectSession(key);
    return key;
  }, [refreshSessions, selectSession]);

  const startConversation = useCallback(
    async (content: string) => {
      const key = await createGatewayUiSession();
      await ipc.chat.send({ sessionId: key, message: content });
    },
    [createGatewayUiSession],
  );

  const onCreateSession = useCallback(() => {
    void createGatewayUiSession().catch(() => {});
  }, [createGatewayUiSession]);

  const onSelectSession = useCallback((id: string) => selectSession(id), [selectSession]);

  const onRenameSession = useCallback(
    (id: string, label: string) => void renameSession(id, label).catch(() => {}),
    [renameSession],
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
        onDeleteSession: deleteSession,
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
      deleteSession,
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
