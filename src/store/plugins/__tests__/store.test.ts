import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Plugin } from "../index";
import { usePluginsStore } from "../index";

const mockDraft = vi.hoisted(() => ({
  snapshotConfig: {} as Record<string, unknown>,
  loadSnapshot: vi.fn(async () => {}),
  applyPatch: vi.fn<(patch: unknown) => Promise<void>>(async () => {}),
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    config: {
      getSnapshot: vi.fn(),
    },
  },
}));

vi.mock("@/store/configDraft", () => ({
  useConfigDraftStore: {
    getState: () => ({
      loadSnapshot: mockDraft.loadSnapshot,
      applyPatch: mockDraft.applyPatch,
      snapshot: {
        config: mockDraft.snapshotConfig,
      },
    }),
  },
}));

const initialPlugins = JSON.parse(JSON.stringify(usePluginsStore.getState().plugins)) as Plugin[];

describe("PluginsStore", () => {
  beforeEach(() => {
    usePluginsStore.setState({
      plugins: JSON.parse(JSON.stringify(initialPlugins)) as Plugin[],
      isLoading: false,
      error: null,
      searchQuery: "",
      categoryFilter: "all",
    });
    mockDraft.snapshotConfig = {};
    mockDraft.loadSnapshot.mockClear();
    mockDraft.applyPatch.mockClear();
    vi.clearAllMocks();
  });

  it("loadPlugins should map config snapshot into plugin state", async () => {
    const { ipc } = await import("@/lib/ipc");
    (ipc.config.getSnapshot as Mock).mockResolvedValue({
      config: {
        plugins: {
          entries: {
            "web-search": {
              enabled: false,
              config: { searchEngine: "bing", maxResults: 3 },
            },
            "notion-sync": {
              enabled: true,
              config: { apiKey: "ntn_key", databaseId: "db_1" },
            },
          },
          installs: {
            "notion-sync": { source: "path", spec: "local" },
          },
        },
      },
    });

    await usePluginsStore.getState().loadPlugins();

    const state = usePluginsStore.getState();
    const webSearch = state.plugins.find((plugin) => plugin.id === "web-search");
    const notionSync = state.plugins.find((plugin) => plugin.id === "notion-sync");

    expect(webSearch?.enabled).toBe(false);
    expect(webSearch?.installed).toBe(true);
    expect(webSearch?.config).toEqual({ searchEngine: "bing", maxResults: 3 });

    expect(notionSync?.enabled).toBe(true);
    expect(notionSync?.installed).toBe(true);
    expect(notionSync?.config).toEqual({ apiKey: "ntn_key", databaseId: "db_1" });
  });

  it("installPlugin should persist entries and installs via configDraft", async () => {
    mockDraft.snapshotConfig = {
      plugins: {
        entries: {
          existing: { enabled: true },
        },
        installs: {
          existing: { source: "npm", spec: "existing@1.0.0" },
        },
      },
    };

    await usePluginsStore.getState().installPlugin("notion-sync");

    const state = usePluginsStore.getState();
    const notionSync = state.plugins.find((plugin) => plugin.id === "notion-sync");

    expect(notionSync?.installed).toBe(true);
    expect(notionSync?.enabled).toBe(true);
    expect(mockDraft.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(mockDraft.applyPatch).toHaveBeenCalledTimes(1);

    const firstCall = mockDraft.applyPatch.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error("missing applyPatch call");
    const patch = firstCall[0] as {
      plugins?: {
        entries?: Record<string, unknown>;
        installs?: Record<string, unknown>;
      };
    };

    expect(patch.plugins?.entries?.existing).toEqual({ enabled: true });
    expect(patch.plugins?.entries?.["notion-sync"]).toEqual({ enabled: true });
    const notionInstall = patch.plugins?.installs?.["notion-sync"] as
      | { source?: string }
      | undefined;
    expect(notionInstall?.source).toBe("path");
  });

  it("uninstallPlugin should remove install record and disable entry", async () => {
    usePluginsStore.setState((state) => ({
      plugins: state.plugins.map((plugin) =>
        plugin.id === "notion-sync"
          ? {
              ...plugin,
              installed: true,
              enabled: true,
            }
          : plugin,
      ),
    }));

    mockDraft.snapshotConfig = {
      plugins: {
        entries: {
          "notion-sync": { enabled: true, config: { apiKey: "token" } },
        },
        installs: {
          "notion-sync": { source: "path", spec: "clawui:notion-sync" },
        },
      },
    };

    await usePluginsStore.getState().uninstallPlugin("notion-sync");

    const state = usePluginsStore.getState();
    const notionSync = state.plugins.find((plugin) => plugin.id === "notion-sync");

    expect(notionSync?.installed).toBe(false);
    expect(notionSync?.enabled).toBe(false);
    expect(mockDraft.applyPatch).toHaveBeenCalledTimes(1);

    const firstCall = mockDraft.applyPatch.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error("missing applyPatch call");
    const patch = firstCall[0] as {
      plugins?: {
        entries?: Record<string, unknown>;
        installs?: Record<string, unknown>;
      };
    };

    expect(patch.plugins?.entries?.["notion-sync"]).toEqual({ enabled: false });
    expect(patch.plugins?.installs?.["notion-sync"]).toBeUndefined();
  });
});
