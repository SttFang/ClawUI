import { describe, expect, it } from "vitest";
import { useExecApprovalsStore } from "..";

describe("execApprovals store", () => {
  it("should clear running keys for a finished session", () => {
    useExecApprovalsStore.setState({
      queue: [],
      busyById: {},
      runningByKey: {
        "agent:main:ui:1::cmd-a": Date.now(),
        "agent:main:ui:1::cmd-b": Date.now(),
        "agent:main:ui:2::cmd-c": Date.now(),
      },
    });

    useExecApprovalsStore.getState().clearRunningForSession("agent:main:ui:1");

    expect(useExecApprovalsStore.getState().runningByKey).toEqual({
      "agent:main:ui:2::cmd-c": expect.any(Number),
    });
  });
});
