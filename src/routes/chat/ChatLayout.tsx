import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatFeature, classifySession, type SessionListItem } from "@/features/Chat";
import { ipc } from "@/lib/ipc";
import { ensureChatConnected } from "@/services/chat/connection";
import { useChatStore, selectCurrentSession, selectSessions } from "@/store/chat";
import { MAIN_SESSION_KEY } from "@/store/chat/helpers";
import { useGatewayStore, selectIsGatewayRunning } from "@/store/gateway";

function hasConfiguredModelAuth(modelsStatus: unknown): boolean {
  if (!modelsStatus || typeof modelsStatus !== "object") return false;

  const auth = (modelsStatus as { auth?: unknown }).auth;
  if (!auth || typeof auth !== "object") return false;

  const providers = (auth as { providers?: unknown[] }).providers;
  if (Array.isArray(providers)) {
    const hasEffectiveProvider = providers.some((p) => {
      if (!p || typeof p !== "object") return false;
      const kind = (p as { effective?: { kind?: unknown } }).effective?.kind;
      return kind === "env" || kind === "profiles" || kind === "token";
    });
    if (hasEffectiveProvider) return true;
  }

  const oauthProviders =
    (auth as { oauth?: { providers?: unknown[] } }).oauth?.providers ??
    (auth as { oauthStatus?: { providers?: unknown[] } }).oauthStatus?.providers;
  if (Array.isArray(oauthProviders)) {
    return oauthProviders.some((p) => {
      if (!p || typeof p !== "object") return false;
      return (p as { status?: unknown }).status === "ok";
    });
  }

  return false;
}

export default function ChatLayout() {
  const navigate = useNavigate();
  const sessions = useChatStore(selectSessions);
  const currentSession = useChatStore(selectCurrentSession);
  const wsConnected = useChatStore((s) => s.wsConnected);
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning);

  const refreshSessions = useChatStore((s) => s.refreshSessions);
  const selectSession = useChatStore((s) => s.selectSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const renameSession = useCallback(
    async (key: string, label: string) => {
      await ensureChatConnected();
      await ipc.chat.request("sessions.patch", { key, label: label.trim() ? label.trim() : null });
      await refreshSessions();
    },
    [refreshSessions],
  );

  const [configValid, setConfigValid] = useState<boolean | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [sessionMetadata, setSessionMetadata] = useState<Record<string, ClawUISessionMetadata>>({});
  const [metaBusyByKey, setMetaBusyByKey] = useState<Record<string, boolean>>({});

  const visibleSessions: SessionListItem[] = useMemo(() => {
    return sessions
      .filter((s) => {
        const { hidden } = classifySession({ sessionKey: s.id, surface: s.surface });
        return !hidden;
      })
      .map((s) => ({ id: s.id, name: s.name, updatedAt: s.updatedAt, surface: s.surface }));
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

  useEffect(() => {
    async function checkConfig() {
      try {
        const [runtimeStatus, modelsStatus] = await Promise.all([
          ipc.onboarding.detect(),
          ipc.models.status(),
        ]);
        const validFromRuntime = runtimeStatus?.configValid ?? false;
        const validFromModels = hasConfiguredModelAuth(modelsStatus);
        setConfigValid(validFromRuntime || validFromModels);
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

  const startConversation = useCallback(
    async (content: string) => {
      const key = await createGatewayUiSession();
      await ipc.chat.send({ sessionId: key, message: content });
    },
    [createGatewayUiSession],
  );

  return (
    <ChatFeature
      sessionState={{
        sessions: visibleSessions,
        currentSessionId: currentSession?.id ?? null,
        sessionMetadata,
        metaBusyByKey,
      }}
      sessionActions={{
        onCreateSession: () => {
          void createGatewayUiSession().catch(() => {});
        },
        onSelectSession: (id) => selectSession(id),
        onRenameSession: (id, label) => void renameSession(id, label).catch(() => {}),
        onDeleteSession: (id) => deleteSession(id),
        onGenerateMetadata: (id) => void generateMetadata(id),
      }}
      uiState={{
        wsConnected,
        isGatewayRunning,
        configValid,
        showBanner,
      }}
      uiActions={{
        onDismissBanner: () => setShowBanner(false),
        onOneClickConfig: () => navigate("/settings"),
        onManualConfig: () => navigate("/settings"),
        onStartConversation: startConversation,
      }}
    />
  );
}
