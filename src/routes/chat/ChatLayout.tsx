import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChatFeature,
  matchesSessionFilter,
  classifySession,
  type SessionFilter,
  type SessionListItem,
} from "@/features/Chat";
import { ipc } from "@/lib/ipc";
import { useChatStore, selectCurrentSession, selectSessions } from "@/store/chat";
import { useGatewayStore, selectIsGatewayRunning } from "@/store/gateway";

export default function ChatLayout() {
  const navigate = useNavigate();
  const sessions = useChatStore(selectSessions);
  const currentSession = useChatStore(selectCurrentSession);
  const wsConnected = useChatStore((s) => s.wsConnected);
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning);

  const refreshSessions = useChatStore((s) => s.refreshSessions);
  const selectSession = useChatStore((s) => s.selectSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const [configValid, setConfigValid] = useState<boolean | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [didLoadSessions, setDidLoadSessions] = useState(false);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("ui");
  const [sessionMetadata, setSessionMetadata] = useState<Record<string, ClawUISessionMetadata>>({});
  const [metaBusyByKey, setMetaBusyByKey] = useState<Record<string, boolean>>({});

  const visibleSessions: SessionListItem[] = useMemo(() => {
    return sessions
      .filter((s) => {
        const { source, hidden } = classifySession({ sessionKey: s.id, surface: s.surface });
        if (hidden) return false;
        return matchesSessionFilter(source, sessionFilter);
      })
      .map((s) => ({ id: s.id, name: s.name, updatedAt: s.updatedAt, surface: s.surface }));
  }, [sessions, sessionFilter]);

  const hasAnyUiSession = useMemo(() => {
    return sessions.some(
      (s) => classifySession({ sessionKey: s.id, surface: s.surface }).source === "ui",
    );
  }, [sessions]);

  useEffect(() => {
    // If the current session is hidden by the filter, select the newest visible one.
    const currentId = currentSession?.id;
    if (!currentId) return;
    if (visibleSessions.some((s) => s.id === currentId)) return;
    const fallback = visibleSessions[0]?.id;
    if (fallback) selectSession(fallback);
  }, [currentSession?.id, visibleSessions, selectSession]);

  useEffect(() => {
    void refreshSessions().finally(() => setDidLoadSessions(true));
  }, [refreshSessions]);

  const createGatewayUiSession = useCallback(async (): Promise<string> => {
    const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
    const uuid = cryptoObj?.randomUUID
      ? cryptoObj.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const key = `agent:main:ui:${uuid}`;

    const connected = await ipc.chat.isConnected();
    if (!connected) {
      const ok = await ipc.chat.connect();
      if (!ok) throw new Error("Failed to connect gateway WebSocket");
    }

    await ipc.chat.request("sessions.reset", { key });
    await refreshSessions();
    selectSession(key);
    return key;
  }, [refreshSessions, selectSession]);

  useEffect(() => {
    if (!didLoadSessions) return;
    // Ensure at least one UI session exists, even if the gateway already has other sessions (discord/cron/etc).
    if (hasAnyUiSession) return;
    void createGatewayUiSession().catch(() => {});
  }, [didLoadSessions, hasAnyUiSession, createGatewayUiSession]);

  useEffect(() => {
    async function checkConfig() {
      try {
        const status = await ipc.onboarding.detect();
        setConfigValid(status?.configValid ?? false);
      } catch {
        setConfigValid(false);
      }
    }
    void checkConfig();
  }, []);

  useEffect(() => {
    ipc.state
      .get()
      .then((state) => setSessionMetadata(state.sessions?.metadata ?? {}))
      .catch(() => {});
  }, []);

  const generateMetadata = async (key: string) => {
    setMetaBusyByKey((m) => ({ ...m, [key]: true }));
    try {
      const meta = await ipc.metadata.generate(key);
      setSessionMetadata((prev) => ({ ...prev, [key]: meta }));
    } finally {
      setMetaBusyByKey((m) => ({ ...m, [key]: false }));
    }
  };

  return (
    <ChatFeature
      sessions={visibleSessions}
      currentSessionId={currentSession?.id ?? null}
      wsConnected={wsConnected}
      isGatewayRunning={isGatewayRunning}
      configValid={configValid}
      showBanner={showBanner}
      onDismissBanner={() => setShowBanner(false)}
      onOneClickConfig={() => navigate("/settings")}
      onManualConfig={() => navigate("/settings")}
      sessionFilter={sessionFilter}
      onSessionFilterChange={setSessionFilter}
      onCreateSession={() => {
        setSessionFilter("ui");
        void createGatewayUiSession().catch(() => {});
      }}
      onSelectSession={(id) => selectSession(id)}
      onDeleteSession={(id) => deleteSession(id)}
      onGenerateMetadata={(id) => void generateMetadata(id)}
      sessionMetadata={sessionMetadata}
      metaBusyByKey={metaBusyByKey}
    />
  );
}
