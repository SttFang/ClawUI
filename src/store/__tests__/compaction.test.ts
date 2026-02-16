import { beforeEach, describe, expect, it } from "vitest";
import { useCompactionStore, selectIsCompacting } from "../compaction";

describe("compactionStore", () => {
  beforeEach(() => {
    useCompactionStore.setState({ sessions: {} });
  });

  it("defaults to not compacting for unknown session", () => {
    const state = useCompactionStore.getState();
    expect(selectIsCompacting("unknown-session")(state)).toBe(false);
  });

  it("sets compacting to true", () => {
    useCompactionStore.getState().setCompacting("session-1", true);
    const state = useCompactionStore.getState();
    expect(selectIsCompacting("session-1")(state)).toBe(true);
  });

  it("sets compacting to false after being true", () => {
    const { setCompacting } = useCompactionStore.getState();
    setCompacting("session-1", true);
    setCompacting("session-1", false);
    const state = useCompactionStore.getState();
    expect(selectIsCompacting("session-1")(state)).toBe(false);
  });

  it("tracks multiple sessions independently", () => {
    const { setCompacting } = useCompactionStore.getState();
    setCompacting("session-a", true);
    setCompacting("session-b", false);
    const state = useCompactionStore.getState();
    expect(selectIsCompacting("session-a")(state)).toBe(true);
    expect(selectIsCompacting("session-b")(state)).toBe(false);
  });
});
