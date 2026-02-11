import { describe, expect, it } from "vitest";
import { deriveExecActionState } from "../execActionState";

describe("deriveExecActionState", () => {
  it("input-available without approval/running should be pending not running", () => {
    const state = deriveExecActionState({
      partState: "input-available",
      preliminary: false,
      approvalRequested: false,
      runningMarked: false,
    });
    expect(state.statusKey).toBe("pending");
    expect(state.running).toBe(false);
  });

  it("approval requested should show waitingApproval", () => {
    const state = deriveExecActionState({
      partState: "input-available",
      preliminary: false,
      approvalRequested: true,
      runningMarked: false,
    });
    expect(state.statusKey).toBe("waitingApproval");
    expect(state.status).toBe("waiting_approval");
  });

  it("preliminary output should be running", () => {
    const state = deriveExecActionState({
      partState: "output-available",
      preliminary: true,
      approvalRequested: false,
      runningMarked: false,
    });
    expect(state.statusKey).toBe("running");
    expect(state.running).toBe(true);
  });
});
