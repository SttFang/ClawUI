import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { usePluginsStore } from "../index";

const mockDraft = vi.hoisted(() => ({
  snapshotConfig: {} as Record<string, unknown>,
  loadSnapshot: vi.fn(async () => {}),
  applyPatch: vi.fn<(patch: unknown) => Promise<void>>(async () => {}),
}));

const schemaFixture = {
  schema: {
    properties: {
      plugins: {
        properties: {
          entries: {
            properties: {
              "notion-sync": {
                properties: {
                  config: {
                    type: "object",
                    required: ["apiKey"],
                    properties: {
                      apiKey: {
                        type: "string",
                      },
                      databaseId: {
                        type: "string",
                      },
                    },
                  },
                },
              },
              "web-search": {
                properties: {
                  config: {
                    type: "object",
                    properties: {
                      searchEngine: {
                        type: "string",
                        enum: ["google", "bing"],
                      },
                      maxResults: {
                        type: "number",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  uiHints: {
    "plugins.entries.notion-sync": {
      label: "Notion Sync",
      help: "Sync data with Notion",
    },
    "plugins.entries.notion-sync.config.apiKey": {
      label: "API Key",
      help: "Notion API key",
    },
    "plugins.entries.web-search": {
      label: "Web Search",
      help: "Search web content",
    },
  },
  version: "test",
  generatedAt: "2026-02-13T00:00:00.000Z",
};

vi.mock("@/lib/ipc", () => ({
  ipc: {
    config: {
      getSnapshot: vi.fn(),
      getSchema: vi.fn(),
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

describe("PluginsStore", () => {
  beforeEach(() => {
    usePluginsStore.setState({
      plugins: [],
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

  it("loadPlugins should build plugin list from schema and map snapshot entries", async () => {
    const { ipc } = await import("@/lib/ipc");
    (ipc.config.getSchema as Mock).mockResolvedValue(schemaFixture);
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
            ghost: {
              enabled: true,
            },
          },
          installs: {
            "notion-sync": { source: "path", spec: "local", version: "1.2.3" },
          },
        },
      },
    });

    await usePluginsStore.getState().loadPlugins();

    const state = usePluginsStore.getState();
    const webSearch = state.plugins.find((plugin) => plugin.id === "web-search");
    const notionSync = state.plugins.find((plugin) => plugin.id === "notion-sync");
    const ghost = state.plugins.find((plugin) => plugin.id === "ghost");

    expect(state.plugins).toHaveLength(2);
    expect(ghost).toBeUndefined();
    expect(webSearch?.installed).toBe(false);
    expect(webSearch?.config).toEqual({ searchEngine: "bing", maxResults: 3 });
    expect(notionSync?.enabled).toBe(true);
    expect(notionSync?.installed).toBe(true);
    expect(notionSync?.version).toBe("1.2.3");
    expect(notionSync?.configSchema?.apiKey?.required).toBe(true);
  });

  it("installPlugin should persist entries and installs via configDraft", async () => {
    const { ipc } = await import("@/lib/ipc");
    (ipc.config.getSchema as Mock).mockResolvedValue(schemaFixture);
    (ipc.config.getSnapshot as Mock).mockResolvedValue({
      config: {
        plugins: {
          entries: {},
          installs: {},
        },
      },
    });

    await usePluginsStore.getState().loadPlugins();

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
    const { ipc } = await import("@/lib/ipc");
    (ipc.config.getSchema as Mock).mockResolvedValue(schemaFixture);
    (ipc.config.getSnapshot as Mock).mockResolvedValue({
      config: {
        plugins: {
          entries: {
            "notion-sync": { enabled: true, config: { apiKey: "token" } },
          },
          installs: {
            "notion-sync": { source: "path", spec: "clawui:notion-sync" },
          },
        },
      },
    });

    await usePluginsStore.getState().loadPlugins();

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
