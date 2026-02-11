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
});
