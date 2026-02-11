import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ipc } from "@/lib/ipc";
import { useModelConfigStore } from "../index";

vi.mock("@/lib/ipc", () => ({
  ipc: {
    models: {
      status: vi.fn(),
      list: vi.fn(),
      listFallbacks: vi.fn(),
      setDefault: vi.fn(),
      addFallback: vi.fn(),
      removeFallback: vi.fn(),
      clearFallbacks: vi.fn(),
      getAuthOrder: vi.fn(),
      setAuthOrder: vi.fn(),
      clearAuthOrder: vi.fn(),
      authLogin: vi.fn(),
    },
  },
}));

describe("ModelConfigStore", () => {
  beforeEach(() => {
    useModelConfigStore.setState({
      status: null,
      catalog: [],
      fallbacks: [],
      authOrderByProvider: {},
      selectedProvider: "",
      isStatusLoading: false,
      isCatalogLoading: false,
      isMutating: false,
      isAuthOrderLoading: false,
      error: null,
      success: null,
      lastProbeAt: null,
    });
    vi.clearAllMocks();

    (ipc.models.status as Mock).mockResolvedValue({
      defaultModel: "openai/gpt-4o",
      fallbacks: [],
      auth: {
        providers: [{ provider: "openai", effective: { kind: "env", detail: "masked" } }],
      },
    });
    (ipc.models.list as Mock).mockResolvedValue({
      count: 1,
      models: [{ key: "openai/gpt-4o", name: "GPT-4o", provider: "openai" }],
    });
    (ipc.models.listFallbacks as Mock).mockResolvedValue({ fallbacks: ["openai/gpt-4o-mini"] });
    (ipc.models.getAuthOrder as Mock).mockResolvedValue({
      agentId: "main",
      provider: "openai",
      order: ["openai:default"],
    });
    (ipc.models.setAuthOrder as Mock).mockResolvedValue({
      agentId: "main",
      provider: "openai",
      order: ["openai:default", "openai:backup"],
    });
    (ipc.models.clearAuthOrder as Mock).mockResolvedValue({
      agentId: "main",
      provider: "openai",
      order: null,
    });
    (ipc.models.authLogin as Mock).mockResolvedValue({ ok: true, stdout: "ok" });
    (ipc.models.setDefault as Mock).mockResolvedValue(undefined);
    (ipc.models.addFallback as Mock).mockResolvedValue(undefined);
    (ipc.models.removeFallback as Mock).mockResolvedValue(undefined);
    (ipc.models.clearFallbacks as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads status/catalog/fallbacks via loadAll", async () => {
    await useModelConfigStore.getState().loadAll();

    const state = useModelConfigStore.getState();
    expect(ipc.models.status).toHaveBeenCalled();
    expect(ipc.models.list).toHaveBeenCalled();
    expect(ipc.models.listFallbacks).toHaveBeenCalled();
    expect(state.selectedProvider).toBe("openai");
    expect(state.catalog[0]?.key).toBe("openai/gpt-4o");
    expect(state.fallbacks).toEqual(["openai/gpt-4o-mini"]);
  });

  it("updates default model and refreshes status", async () => {
    await useModelConfigStore.getState().setDefaultModel("openai/gpt-4.1");

    expect(ipc.models.setDefault).toHaveBeenCalledWith("openai/gpt-4.1");
    expect(ipc.models.status).toHaveBeenCalled();
    expect(useModelConfigStore.getState().success).toBeTruthy();
  });

  it("normalizes profile ids before saving auth order", async () => {
    useModelConfigStore.setState({ selectedProvider: "openai" });

    await useModelConfigStore
      .getState()
      .saveAuthOrder(["openai:default", "openai:default", "openai:backup"], "openai");

    expect(ipc.models.setAuthOrder).toHaveBeenCalledWith({
      provider: "openai",
      profileIds: ["openai:default", "openai:backup"],
    });
  });

  it("maps auth login interactive tty error to actionable message", async () => {
    (ipc.models.authLogin as Mock).mockRejectedValue(
      new Error("models auth login requires interactive TTY."),
    );
    useModelConfigStore.setState({ selectedProvider: "openai-codex" });

    await useModelConfigStore.getState().runAuthLogin();

    expect(useModelConfigStore.getState().error).toContain("openclaw models auth login");
  });
});
