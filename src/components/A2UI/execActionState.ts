import type { ChainOfActionStatus } from "@clawui/ui";

type ExecPartState = "input-available" | "input-streaming" | "output-available";

export function deriveExecActionState(input: {
  partState: ExecPartState;
  preliminary: boolean;
  approvalRequested: boolean;
  runningMarked: boolean;
}): {
  status: ChainOfActionStatus;
  statusKey: "waitingApproval" | "pending" | "running";
  running: boolean;
} {
  const { partState, preliminary, approvalRequested, runningMarked } = input;

  const running =
    partState === "input-streaming" ||
    (partState === "output-available" && preliminary) ||
    runningMarked;

  if (approvalRequested) {
    return { status: "waiting_approval", statusKey: "waitingApproval", running: false };
  }
  if (running) {
    return { status: "running", statusKey: "running", running: true };
  }
  return { status: "idle", statusKey: "pending", running: false };
}
