import { describe, expect, it, vi } from "vitest";
import type { ConfigDraftStoreLike, ConfigObject, ConfigPathSegment } from "../types";
import { createEnvPathPatches, readConfigEnvVars } from "../env";
import { ConfigCoreManager } from "../manager";

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
} {
  const state = {
    snapshot: { config, hash: "hash-1" },
    draft: JSON.parse(JSON.stringify(config)) as ConfigObject,
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
    applyDraft: vi.fn().mockResolvedValue(undefined),
  };

  return {
    store: {
      getState: () => state,
    },
    applyDraft: state.applyDraft,
    patchDraftPath: state.patchDraftPath,
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
    const { store, applyDraft, patchDraftPath } = createMockStore({
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
    expect(patchDraftPath).toHaveBeenCalledWith(["env", "vars", "OPENAI_API_KEY"], "sk-openai");
    expect(patchDraftPath).toHaveBeenCalledWith(["env", "OPENAI_API_KEY"], "sk-openai");
  });
});
