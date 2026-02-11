import { describe, expect, it, vi } from "vitest";
import type { ConfigDraftStoreLike, ConfigObject, ConfigPathSegment } from "../types";
import { createEnvPathPatches, readConfigEnvVars } from "../env";
import { ConfigCoreManager } from "../manager";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setPathValue(
  source: Record<string, unknown>,
  path: Array<ConfigPathSegment>,
  value: unknown,
): void {
  let cursor: Record<string, unknown> = source;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = String(path[i]);
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[String(path[path.length - 1])] = value;
}

function createMockStore(config: ConfigObject): {
  store: ConfigDraftStoreLike;
  applyDraft: ReturnType<typeof vi.fn>;
  patchDraftPath: ReturnType<typeof vi.fn>;
  resetDraftToSnapshot: ReturnType<typeof vi.fn>;
  state: {
    snapshot: { config: ConfigObject; hash: string };
    draft: ConfigObject;
    loadSnapshot: ReturnType<typeof vi.fn>;
    patchDraft: ReturnType<typeof vi.fn>;
    patchDraftPath: ReturnType<typeof vi.fn>;
    resetDraftToSnapshot: ReturnType<typeof vi.fn>;
    applyDraft: ReturnType<typeof vi.fn>;
  };
} {
  const state = {
    snapshot: { config, hash: "hash-1" },
    draft: deepClone(config),
    loadSnapshot: vi.fn().mockResolvedValue(undefined),
    patchDraft: vi.fn().mockImplementation(async (patch: ConfigObject) => {
      state.draft = {
        ...state.draft,
        ...patch,
      };
    }),
    patchDraftPath: vi
      .fn()
      .mockImplementation(async (path: Array<ConfigPathSegment>, value: unknown) => {
        setPathValue(state.draft as Record<string, unknown>, path, value);
      }),
    resetDraftToSnapshot: vi.fn().mockImplementation(async () => {
      state.draft = deepClone(state.snapshot.config);
    }),
    applyDraft: vi.fn().mockResolvedValue(undefined),
  };

  return {
    store: {
      getState: () => state,
    },
    applyDraft: state.applyDraft,
    patchDraftPath: state.patchDraftPath,
    resetDraftToSnapshot: state.resetDraftToSnapshot,
    state,
  };
}

describe("config-core", () => {
  it("readConfigEnvVars should merge env.vars and legacy env keys", () => {
    const env = readConfigEnvVars({
      env: {
        vars: {
          OPENAI_API_KEY: "vars-key",
          OPENROUTER_API_KEY: "vars-or-key",
        },
        OPENAI_API_KEY: "legacy-key",
        shellEnv: { enabled: true },
      },
    });

    expect(env.OPENAI_API_KEY).toBe("legacy-key");
    expect(env.OPENROUTER_API_KEY).toBe("vars-or-key");
  });

  it("createEnvPathPatches should write both vars and legacy paths", () => {
    const patches = createEnvPathPatches({
      OPENAI_API_KEY: "sk-openai",
      OPENROUTER_API_KEY: null,
    });

    expect(patches).toEqual([
      { path: ["env", "vars", "OPENAI_API_KEY"], value: "sk-openai" },
      { path: ["env", "OPENAI_API_KEY"], value: "sk-openai" },
      { path: ["env", "vars", "OPENROUTER_API_KEY"], value: undefined },
      { path: ["env", "OPENROUTER_API_KEY"], value: undefined },
    ]);
  });

  it("ConfigCoreManager should retry once on base hash conflict", async () => {
    const { store, applyDraft, patchDraftPath, resetDraftToSnapshot } = createMockStore({
      env: { vars: {} },
    });
    const manager = new ConfigCoreManager(store, { conflictRetryCount: 1 });

    const conflict = Object.assign(new Error("conflict"), {
      code: "CONFIG_BASE_HASH_CONFLICT",
    });
    applyDraft.mockRejectedValueOnce(conflict).mockResolvedValue(undefined);

    await manager.applyEnvPatch({
      OPENAI_API_KEY: "sk-openai",
    });

    expect(applyDraft).toHaveBeenCalledTimes(2);
    expect(resetDraftToSnapshot).toHaveBeenCalledTimes(2);
    expect(patchDraftPath).toHaveBeenCalledWith(["env", "vars", "OPENAI_API_KEY"], "sk-openai");
    expect(patchDraftPath).toHaveBeenCalledWith(["env", "OPENAI_API_KEY"], "sk-openai");
  });

  it("ConfigCoreManager should rebase patch on latest snapshot after conflict", async () => {
    const { store, state } = createMockStore({
      tools: { elevated: { allowFrom: { webchat: false } } },
      agents: { defaults: { sandbox: { mode: "off" } } },
    });
    const manager = new ConfigCoreManager(store, { conflictRetryCount: 1 });

    let applyCount = 0;
    state.applyDraft.mockImplementation(async () => {
      applyCount += 1;

      if (applyCount === 1) {
        state.snapshot = {
          config: {
            tools: { elevated: { allowFrom: { webchat: false } } },
            agents: { defaults: { sandbox: { mode: "all" } } },
            memory: { enabled: true },
          },
          hash: "hash-2",
        };
        throw Object.assign(new Error("conflict"), { code: "CONFIG_BASE_HASH_CONFLICT" });
      }

      state.snapshot = {
        config: deepClone(state.draft),
        hash: "hash-3",
      };
    });

    await manager.applyPathPatch(["tools", "elevated", "allowFrom", "webchat"], true);

    expect(state.snapshot.config).toEqual({
      tools: { elevated: { allowFrom: { webchat: true } } },
      agents: { defaults: { sandbox: { mode: "all" } } },
      memory: { enabled: true },
    });
  });

  it("ConfigCoreManager should read snapshot by default and support explicit source", () => {
    const { store } = createMockStore({
      env: {
        vars: { OPENAI_API_KEY: "snapshot-key" },
      },
    });

    const state = store.getState();
    state.draft = {
      env: {
        vars: { OPENAI_API_KEY: "draft-key" },
      },
    };

    const manager = new ConfigCoreManager(store);

    expect(manager.getEnvValue("OPENAI_API_KEY")).toBe("snapshot-key");
    expect(manager.getEnvValue("OPENAI_API_KEY", "draft")).toBe("draft-key");
    expect(manager.getEnvValue("OPENAI_API_KEY", "auto")).toBe("draft-key");
  });

  it("ConfigCoreManager should honor readSource option", () => {
    const { store } = createMockStore({
      env: {
        vars: { OPENAI_API_KEY: "snapshot-key" },
      },
    });
    const state = store.getState();
    state.draft = {
      env: {
        vars: { OPENAI_API_KEY: "draft-key" },
      },
    };

    const manager = new ConfigCoreManager(store, { readSource: "auto" });
    expect(manager.getEnvValue("OPENAI_API_KEY")).toBe("draft-key");
  });
});
