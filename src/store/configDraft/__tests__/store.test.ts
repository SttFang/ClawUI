import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ipc } from "@/lib/ipc";
import { useConfigDraftStore } from "../index";

vi.mock("@/lib/ipc", () => ({
  ipc: {
    config: {
      getSnapshot: vi.fn(),
      setDraft: vi.fn(),
      getSchema: vi.fn(),
    },
  },
}));

describe("ConfigDraftStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigDraftStore.setState({
      snapshot: null,
      schema: null,
      draft: null,
      isLoading: false,
      isSaving: false,
      isDirty: false,
      error: null,
      errorCode: null,
    });
  });

  it("resetDraftToSnapshot should drop dirty draft and rebase to latest snapshot", async () => {
    (ipc.config.getSnapshot as Mock)
      .mockResolvedValueOnce({
        hash: "hash-1",
        config: {
          env: {
            vars: { OPENAI_API_KEY: "snapshot-1" },
          },
        },
      })
      .mockResolvedValueOnce({
        hash: "hash-2",
        config: {
          env: {
            vars: { OPENAI_API_KEY: "snapshot-2" },
          },
        },
      });

    await useConfigDraftStore.getState().loadSnapshot();
    await useConfigDraftStore.getState().patchDraftPath(["env", "vars", "OPENAI_API_KEY"], "draft");
    await useConfigDraftStore.getState().resetDraftToSnapshot();

    const state = useConfigDraftStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.snapshot?.hash).toBe("hash-2");
    expect(state.draft).toEqual({
      env: {
        vars: { OPENAI_API_KEY: "snapshot-2" },
      },
    });
  });

  it("loadSnapshot should still preserve dirty draft", async () => {
    (ipc.config.getSnapshot as Mock)
      .mockResolvedValueOnce({
        hash: "hash-1",
        config: {
          env: {
            vars: { OPENAI_API_KEY: "snapshot-1" },
          },
        },
      })
      .mockResolvedValueOnce({
        hash: "hash-2",
        config: {
          env: {
            vars: { OPENAI_API_KEY: "snapshot-2" },
          },
        },
      });

    await useConfigDraftStore.getState().loadSnapshot();
    await useConfigDraftStore
      .getState()
      .patchDraftPath(["env", "vars", "OPENAI_API_KEY"], "dirty-draft");
    await useConfigDraftStore.getState().loadSnapshot(true);

    const state = useConfigDraftStore.getState();
    expect(state.isDirty).toBe(true);
    expect(state.snapshot?.hash).toBe("hash-2");
    expect(state.draft).toEqual({
      env: {
        vars: { OPENAI_API_KEY: "dirty-draft" },
      },
    });
  });

  it("applyPatch should persist merged full config and reload snapshot after save", async () => {
    const baseSnapshot = {
      hash: "hash-1",
      config: {
        gateway: {
          mode: "local",
          port: 18789,
          bind: "loopback",
          auth: {
            mode: "token",
            token: "token-1",
          },
        },
        agents: {
          defaults: {
            workspace: "~/.openclaw/workspace",
            model: {
              primary: "anthropic/claude-4-5-20250929",
              fallbacks: ["openai/gpt-4o"],
            },
          },
        },
        session: {
          scope: "per-sender",
          store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
          reset: {
            mode: "idle",
            idleMinutes: 120,
          },
        },
        channels: {
          telegram: {
            enabled: true,
          },
        },
        tools: {
          allow: ["group:fs", "web_*"],
          deny: ["exec"],
        },
        cron: {
          enabled: true,
          store: "~/.openclaw/cron/jobs.json",
        },
        hooks: {
          enabled: true,
          token: "hooks-token",
          path: "/hooks",
        },
        mcp: {
          enabled: false,
        },
        env: {
          vars: {
            OPENAI_API_KEY: "old-openai",
            OPENROUTER_API_KEY: "old-openrouter",
          },
        },
      },
    };

    const savedSnapshot = {
      ...baseSnapshot,
      hash: "hash-2",
      config: {
        ...baseSnapshot.config,
        gateway: {
          ...baseSnapshot.config.gateway,
          port: 19999,
        },
        agents: {
          ...baseSnapshot.config.agents,
          defaults: {
            ...baseSnapshot.config.agents.defaults,
            workspace: "~/workspace-updated",
          },
        },
        mcp: {
          ...baseSnapshot.config.mcp,
          enabled: true,
          servers: {
            github: {
              command: "node github-mcp",
            },
          },
        },
        env: {
          ...baseSnapshot.config.env,
          vars: {
            ...baseSnapshot.config.env.vars,
            OPENAI_API_KEY: "new-openai",
            GITHUB_TOKEN: "gh-token",
          },
        },
      },
    };

    (ipc.config.getSnapshot as Mock).mockResolvedValueOnce(baseSnapshot).mockResolvedValueOnce(savedSnapshot);

    useConfigDraftStore.setState({
      snapshot: null,
      draft: null,
    });

    await useConfigDraftStore.getState().applyPatch({
      gateway: {
        port: 19999,
      },
      agents: {
        defaults: {
          workspace: "~/workspace-updated",
        },
      },
      mcp: {
        enabled: true,
        servers: {
          github: {
            command: "node github-mcp",
          },
        },
      },
      env: {
        vars: {
          OPENAI_API_KEY: "new-openai",
          GITHUB_TOKEN: "gh-token",
        },
      },
    });

    expect(ipc.config.setDraft).toHaveBeenCalledTimes(1);

    const payload = (ipc.config.setDraft as Mock).mock.calls[0][0];
    const writtenConfig = JSON.parse(payload.raw as string);

    expect(payload.baseHash).toBe("hash-1");
    expect(payload.raw.endsWith("\n")).toBe(true);
    expect(writtenConfig).toEqual(savedSnapshot.config);
    expect(useConfigDraftStore.getState().isDirty).toBe(false);
    expect(useConfigDraftStore.getState().snapshot).toEqual(savedSnapshot);
    expect(useConfigDraftStore.getState().draft).toEqual(savedSnapshot.config);
  });
});
