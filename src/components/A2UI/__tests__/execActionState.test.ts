import { describe, expect, it } from "vitest";
import { deriveExecActionState } from "../execActionState";

describe("deriveExecActionState", () => {
  it("input-available without approval/running should be pending not running", () => {
    const state = deriveExecActionState({
      partState: "input-available",
      preliminary: false,
      approvalRequested: false,
      runningMarked: false,
      hasFinalOutput: false,
      hasError: false,
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
      hasFinalOutput: false,
      hasError: false,
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
      hasFinalOutput: false,
      hasError: false,
    });
    expect(state.statusKey).toBe("running");
    expect(state.running).toBe(true);
  });

  it("final output should win over running mark", () => {
    const state = deriveExecActionState({
      partState: "output-available",
      preliminary: false,
      approvalRequested: false,
      runningMarked: true,
      hasFinalOutput: true,
      hasError: false,
    });
    expect(state.statusKey).toBe("completed");
    expect(state.running).toBe(false);
  });

  it("error should win over running mark", () => {
    const state = deriveExecActionState({
      partState: "output-error",
      preliminary: false,
      approvalRequested: false,
      runningMarked: true,
      hasFinalOutput: false,
      hasError: true,
    });
    expect(state.statusKey).toBe("error");
    expect(state.running).toBe(false);
  });

  it("waitingApproval should keep priority over running mark", () => {
    const state = deriveExecActionState({
      partState: "input-streaming",
      preliminary: false,
      approvalRequested: true,
      runningMarked: true,
      hasFinalOutput: false,
      hasError: false,
    });
    expect(state.statusKey).toBe("waitingApproval");
    expect(state.running).toBe(false);
  });

  it("final output should win over stale approval flag", () => {
    const state = deriveExecActionState({
      partState: "output-available",
      preliminary: false,
      approvalRequested: true,
      runningMarked: false,
      hasFinalOutput: true,
      hasError: false,
    });
    expect(state.statusKey).toBe("completed");
    expect(state.running).toBe(false);
  });
});
