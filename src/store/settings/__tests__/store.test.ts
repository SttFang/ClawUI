import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ipc } from "@/lib/ipc";
import { configCoreManager } from "@/store/configDraft/manager";
import { useSettingsStore } from "../index";

vi.mock("@/lib/ipc", () => ({
  ipc: {
    models: {
      status: vi.fn(),
    },
    state: {
      get: vi.fn(),
      patch: vi.fn(),
    },
  },
}));

vi.mock("@/store/configDraft/manager", () => ({
  configCoreManager: {
    loadSnapshot: vi.fn(),
    getEnv: vi.fn(() => ({})),
    applyEnvPatch: vi.fn(),
  },
}));

const initialState = {
  apiKeys: {
    anthropic: "",
    openai: "",
    openrouter: "",
  },
  autoStartGateway: true,
  autoCheckUpdates: true,
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,
  modelsStatus: null,
  modelsLoading: false,
};

describe("SettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState(initialState);
    vi.clearAllMocks();
    vi.useFakeTimers();

    (configCoreManager.loadSnapshot as Mock).mockResolvedValue(undefined);
    (configCoreManager.getEnv as Mock).mockReturnValue({});
    (configCoreManager.applyEnvPatch as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("loadSettings", () => {
    it("should load API keys from config snapshot env", async () => {
      (configCoreManager.getEnv as Mock).mockReturnValue({
        ANTHROPIC_API_KEY: "sk-ant-xxx",
        OPENAI_API_KEY: "sk-openai-xxx",
        OPENROUTER_API_KEY: "sk-or-xxx",
      });

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(configCoreManager.loadSnapshot).toHaveBeenCalled();
      expect(state.apiKeys.anthropic).toBe("sk-ant-xxx");
      expect(state.apiKeys.openai).toBe("sk-openai-xxx");
      expect(state.apiKeys.openrouter).toBe("sk-or-xxx");
      expect(state.isLoading).toBe(false);
    });

    it("should handle partial env values", async () => {
      (configCoreManager.getEnv as Mock).mockReturnValue({
        ANTHROPIC_API_KEY: "sk-ant-xxx",
      });

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.apiKeys.anthropic).toBe("sk-ant-xxx");
      expect(state.apiKeys.openai).toBe("");
      expect(state.apiKeys.openrouter).toBe("");
    });

    it("should handle load error", async () => {
      (configCoreManager.loadSnapshot as Mock).mockRejectedValue(new Error("Config read failed"));

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.error).toBe("Config read failed");
      expect(state.isLoading).toBe(false);
    });

    it("should set loading state during load", async () => {
      let capturedLoading = false;
      (configCoreManager.loadSnapshot as Mock).mockImplementation(async () => {
        capturedLoading = useSettingsStore.getState().isLoading;
      });

      await useSettingsStore.getState().loadSettings();

      expect(capturedLoading).toBe(true);
    });
  });

  describe("loadModelsStatus", () => {
    it("should hydrate models status and provider api keys", async () => {
      (ipc.models.status as Mock).mockResolvedValue({
        defaultModel: "google/gemini-3-pro",
        fallbacks: [],
        auth: {
          providers: [
            {
              provider: "google",
              effective: { kind: "env", detail: "masked" },
              env: { source: "env: GEMINI_API_KEY" },
            },
          ],
        },
      });
      (configCoreManager.getEnv as Mock).mockReturnValue({
        GEMINI_API_KEY: "sk-gemini-xxx",
      });

      await useSettingsStore.getState().loadModelsStatus();

      const state = useSettingsStore.getState();
      expect(configCoreManager.loadSnapshot).toHaveBeenCalled();
      expect(state.modelsStatus?.defaultModel).toBe("google/gemini-3-pro");
      expect(state.apiKeys.google).toBe("sk-gemini-xxx");
      expect(state.modelsLoading).toBe(false);
    });

    it("should handle status load error", async () => {
      (ipc.models.status as Mock).mockRejectedValue(new Error("status failed"));

      await useSettingsStore.getState().loadModelsStatus();

      const state = useSettingsStore.getState();
      expect(state.modelsStatus).toBeNull();
      expect(state.modelsLoading).toBe(false);
    });
  });

  describe("setApiKey", () => {
    it("should update API key and clear save success", () => {
      useSettingsStore.setState({ saveSuccess: true });

      useSettingsStore.getState().setApiKey("openai", "sk-openai-new");

      const state = useSettingsStore.getState();
      expect(state.apiKeys.openai).toBe("sk-openai-new");
      expect(state.saveSuccess).toBe(false);
    });

    it("should normalize provider aliases", () => {
      useSettingsStore.getState().setApiKey("z.ai", "sk-zai");
      expect(useSettingsStore.getState().apiKeys.zai).toBe("sk-zai");
    });
  });

  describe("saveApiKeys", () => {
    it("should save all API keys through config core manager", async () => {
      useSettingsStore.setState({
        apiKeys: {
          anthropic: "sk-ant-xxx",
          openai: "sk-openai-xxx",
          openrouter: "sk-or-xxx",
        },
      });

      await useSettingsStore.getState().saveApiKeys();

      expect(configCoreManager.applyEnvPatch).toHaveBeenCalledWith({
        ANTHROPIC_API_KEY: "sk-ant-xxx",
        OPENAI_API_KEY: "sk-openai-xxx",
        OPENROUTER_API_KEY: "sk-or-xxx",
      });
      expect(useSettingsStore.getState().saveSuccess).toBe(true);
    });

    it("should support provider-scoped save", async () => {
      useSettingsStore.setState({
        apiKeys: {
          anthropic: "",
          openai: "",
          openrouter: "",
          google: "gemini-key",
        },
      });

      await useSettingsStore.getState().saveApiKeys("google");

      expect(configCoreManager.applyEnvPatch).toHaveBeenCalledWith({
        GEMINI_API_KEY: "gemini-key",
      });
    });

    it("should reject unsupported provider-scoped save", async () => {
      useSettingsStore.setState({
        apiKeys: {
          anthropic: "",
          openai: "",
          openrouter: "",
          "custom-provider": "sk-custom",
        },
      });

      await useSettingsStore.getState().saveApiKeys("custom-provider");

      const state = useSettingsStore.getState();
      expect(state.error).toContain(
        'Provider "custom-provider" does not support API key persistence.',
      );
      expect(configCoreManager.applyEnvPatch).not.toHaveBeenCalled();
    });

    it("should clear saveSuccess after 3 seconds", async () => {
      await useSettingsStore.getState().saveApiKeys();
      expect(useSettingsStore.getState().saveSuccess).toBe(true);

      vi.advanceTimersByTime(3000);

      expect(useSettingsStore.getState().saveSuccess).toBe(false);
    });

    it("should handle save error", async () => {
      (configCoreManager.applyEnvPatch as Mock).mockRejectedValue(new Error("Write failed"));
      useSettingsStore.setState({
        apiKeys: {
          anthropic: "sk-ant-xxx",
          openai: "",
          openrouter: "",
        },
      });

      await useSettingsStore.getState().saveApiKeys();

      const state = useSettingsStore.getState();
      expect(state.error).toBe("Write failed");
      expect(state.isSaving).toBe(false);
      expect(state.saveSuccess).toBe(false);
    });
  });

  describe("preferences", () => {
    it("should update autoStartGateway", async () => {
      (ipc.state.patch as Mock).mockResolvedValue({});

      await useSettingsStore.getState().setAutoStartGateway(false);
      expect(useSettingsStore.getState().autoStartGateway).toBe(false);
    });

    it("should update autoCheckUpdates", async () => {
      (ipc.state.patch as Mock).mockResolvedValue({});

      await useSettingsStore.getState().setAutoCheckUpdates(false);
      expect(useSettingsStore.getState().autoCheckUpdates).toBe(false);
    });

    it("should load preferences from clawui state", async () => {
      (ipc.state.get as Mock).mockResolvedValue({
        openclaw: { autoStart: { main: false } },
        app: { autoCheckUpdates: false },
      });

      await useSettingsStore.getState().loadPreferences();

      expect(useSettingsStore.getState().autoStartGateway).toBe(false);
      expect(useSettingsStore.getState().autoCheckUpdates).toBe(false);
    });
  });

  describe("selectors", () => {
    it("should expose selector values", async () => {
      const { selectApiKeys, selectAutoStartGateway, selectSaveSuccess } = await import("../index");
      useSettingsStore.setState({
        apiKeys: {
          anthropic: "sk-ant-xxx",
          openai: "",
          openrouter: "",
        },
        autoStartGateway: false,
        saveSuccess: true,
      });

      expect(selectApiKeys(useSettingsStore.getState()).anthropic).toBe("sk-ant-xxx");
      expect(selectAutoStartGateway(useSettingsStore.getState())).toBe(false);
      expect(selectSaveSuccess(useSettingsStore.getState())).toBe(true);
    });
  });
});
