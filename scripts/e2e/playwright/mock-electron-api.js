(() => {
  const sessionKey = "agent:main:ui:e2e-approval-session";
  const now = Date.now();

  const histories = {
    initial: [
      { id: "m1", role: "user", content: "整理桌面", timestamp: now - 8000 },
      { id: "m2", role: "assistant", content: "行，我来干。", timestamp: now - 7000 },
      {
        id: "m3",
        role: "assistant",
        content: "我先扫一眼你桌面现在有哪些东西，再按可恢复归档方式整理。",
        timestamp: now - 6000,
      },
      {
        id: "m4",
        role: "assistant",
        content: "刚才系统拦了我的读取命令，需要你点一下批准执行。",
        timestamp: now - 5000,
      },
      {
        id: "m5",
        role: "system",
        content: "System: approval pending (id=e2e-approval-1)",
        timestamp: now - 4000,
      },
      {
        id: "m6",
        role: "assistant",
        content: "TOTAL 15 ...",
        timestamp: now - 3000,
      },
      { id: "m7", role: "user", content: "结果呢", timestamp: now - 2000 },
      {
        id: "m8",
        role: "assistant",
        content: "结果：你的桌面已经很干净了。",
        timestamp: now - 1000,
      },
    ],
    updated: [
      { id: "m1", role: "user", content: "整理桌面", timestamp: now - 8000 },
      { id: "m2", role: "assistant", content: "行，我来干。", timestamp: now - 7000 },
      {
        id: "m3",
        role: "assistant",
        content: "我先扫一眼你桌面现在有哪些东西，再按可恢复归档方式整理。",
        timestamp: now - 6000,
      },
      {
        id: "m4",
        role: "assistant",
        content: "刚才系统拦了我的读取命令，需要你点一下批准执行。",
        timestamp: now - 5000,
      },
      {
        id: "m5",
        role: "system",
        content:
          "System: Exec finished (gateway id=e2e-approval-1, session=fast-coral, code 0)\nTOTAL 15",
        timestamp: now - 4000,
      },
      {
        id: "m6",
        role: "assistant",
        content: "TOTAL 15 ...",
        timestamp: now - 3000,
      },
      { id: "m7", role: "user", content: "结果呢", timestamp: now - 2000 },
      {
        id: "m8",
        role: "assistant",
        content: "结果：你的桌面已经很干净了。",
        timestamp: now - 1000,
      },
    ],
  };

  const state = {
    connected: false,
    gatewayStatus: "stopped",
    historyMode: "initial",
    sentMessages: [],
  };

  const listeners = {
    gatewayStatus: [],
    gatewayEvent: [],
    chatStream: [],
    chatConnected: [],
    chatDisconnected: [],
    chatError: [],
    chatNormalized: [],
    installProgress: [],
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function subscribe(bucket, callback) {
    bucket.push(callback);
    return () => {
      const index = bucket.indexOf(callback);
      if (index >= 0) bucket.splice(index, 1);
    };
  }

  function emit(bucket, payload) {
    for (const callback of bucket.slice()) {
      try {
        callback(payload);
      } catch {
        // ignore test mock listener errors
      }
    }
  }

  const api = {
    gateway: {
      async start() {
        state.gatewayStatus = "running";
        emit(listeners.gatewayStatus, "running");
      },
      async stop() {
        state.gatewayStatus = "stopped";
        emit(listeners.gatewayStatus, "stopped");
      },
      async getStatus() {
        return state.gatewayStatus;
      },
      async installService() {},
      async restartService() {},
      async uninstallService() {},
      onStatusChange(callback) {
        return subscribe(listeners.gatewayStatus, callback);
      },
      onEvent(callback) {
        return subscribe(listeners.gatewayEvent, callback);
      },
    },
    config: {
      async get() {
        return {};
      },
      async set() {},
      async getSnapshot() {
        return { baseVersion: 1, currentVersion: 1, draft: {} };
      },
      async getSchema() {
        return { version: 1, fields: [] };
      },
      async setDraft() {
        return { ok: true, version: 1 };
      },
      async getPath() {
        return "/tmp/config.json";
      },
    },
    profiles: {
      async ensure() {
        return { paths: { main: "/tmp/main", configAgent: "/tmp/config-agent" } };
      },
      async patchEnvBoth() {},
      async getConfigPath() {
        return "/tmp/config.json";
      },
    },
    state: {
      async get() {
        return {
          ui: { theme: "system", locale: "zh-CN", sidebarCollapsed: false },
          sessions: { metadata: {} },
          openclaw: { autoStart: { main: true, configAgent: false } },
        };
      },
      async patch() {
        return {
          ui: {},
          sessions: { metadata: {} },
          openclaw: {},
        };
      },
      async getPath() {
        return "/tmp/state.json";
      },
    },
    subscription: {
      async login() {
        return { ok: false, error: "not-implemented" };
      },
      async logout() {},
      async getStatus() {
        return { loggedIn: false };
      },
    },
    app: {
      async getVersion() {
        return "0.1.0-e2e";
      },
      async checkForUpdates() {
        return null;
      },
      quitAndInstall() {},
      minimize() {},
      maximize() {},
      close() {},
    },
    onboarding: {
      async detect() {
        return {
          openclawInstalled: true,
          configValid: true,
          gatewayInstalled: true,
        };
      },
      async install() {},
      async uninstall() {},
      async configureSubscription() {},
      async configureBYOK() {},
      async validateApiKey() {
        return true;
      },
      async readConfig() {
        return {};
      },
      onInstallProgress(callback) {
        return subscribe(listeners.installProgress, callback);
      },
    },
    chat: {
      async connect() {
        state.connected = true;
        emit(listeners.chatConnected);
        return true;
      },
      async disconnect() {
        state.connected = false;
        emit(listeners.chatDisconnected);
        return true;
      },
      async send(request) {
        const runId = `client-${Date.now()}`;
        state.sentMessages.push({
          sessionId: request?.sessionId ?? "",
          message: request?.message ?? "",
          runId,
          ts: Date.now(),
        });
        return runId;
      },
      async request(method, params) {
        if (method === "sessions.list") {
          return {
            sessions: [
              {
                key: sessionKey,
                derivedTitle: "E2E Approval Session",
                updatedAt: Date.now(),
                surface: "ui",
              },
            ],
          };
        }
        if (method === "chat.history") {
          const requestedKey =
            typeof params?.sessionKey === "string" ? params.sessionKey : sessionKey;
          if (requestedKey !== sessionKey) return { messages: [] };
          return { messages: clone(histories[state.historyMode]) };
        }
        if (method === "chat.abort") return { ok: true };
        if (method === "sessions.patch") return { ok: true };
        if (method === "sessions.reset") return { ok: true };
        if (method === "exec.approval.resolve") return { ok: true };
        return {};
      },
      async isConnected() {
        return state.connected;
      },
      onStream(callback) {
        return subscribe(listeners.chatStream, callback);
      },
      onConnected(callback) {
        return subscribe(listeners.chatConnected, callback);
      },
      onDisconnected(callback) {
        return subscribe(listeners.chatDisconnected, callback);
      },
      onError(callback) {
        return subscribe(listeners.chatError, callback);
      },
      onNormalizedEvent(callback) {
        return subscribe(listeners.chatNormalized, callback);
      },
    },
    usage: {
      async sessions() {
        return {};
      },
      async cost() {
        return {};
      },
      async timeseries() {
        return {};
      },
      async logs() {
        return {};
      },
    },
    models: {
      async status() {
        return {
          auth: {
            providers: [{ effective: { kind: "env" } }],
          },
        };
      },
    },
    metadata: {
      async generate() {
        return {
          summary: "E2E Session",
          tags: [],
        };
      },
    },
    secrets: {
      async patch() {},
    },
    security: {
      async get() {
        return {};
      },
      async apply() {},
    },
    skills: {
      async list() {
        return {
          profiles: { main: { dir: "", skills: [] }, configAgent: { dir: "", skills: [] } },
        };
      },
    },
  };

  Object.defineProperty(window, "electron", {
    value: api,
    configurable: true,
    writable: false,
  });

  window.__CLAWUI_E2E__ = {
    sessionKey,
    switchHistory(mode) {
      if (mode === "initial" || mode === "updated") {
        state.historyMode = mode;
      }
    },
    emitNormalizedEvent(partial) {
      const event = {
        kind: "run.approval_resolved",
        traceId: "trace-e2e-1",
        timestampMs: Date.now(),
        sessionKey,
        clientRunId: "client-e2e-1",
        status: "running",
        ...partial,
      };
      emit(listeners.chatNormalized, event);
    },
    emitGatewayEvent(frame) {
      emit(listeners.gatewayEvent, frame);
    },
    getSentMessages() {
      return clone(state.sentMessages);
    },
  };
})();
