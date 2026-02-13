import type { ChainOfActionStatus } from "@clawui/ui";

type ExecPartState = "input-available" | "input-streaming" | "output-available" | "output-error";

export function deriveExecActionState(input: {
  partState: ExecPartState;
  preliminary: boolean;
  approvalRequested: boolean;
  runningMarked: boolean;
  traceRunning: boolean;
  hasFinalOutput: boolean;
  hasError: boolean;
}): {
  status: ChainOfActionStatus;
  statusKey: "waitingApproval" | "pending" | "running" | "completed" | "error";
  running: boolean;
} {
  const {
    partState,
    preliminary,
    approvalRequested,
    runningMarked,
    traceRunning,
    hasFinalOutput,
    hasError,
  } = input;

  if (hasError || partState === "output-error") {
    return { status: "error", statusKey: "error", running: false };
  }

  if (hasFinalOutput) {
    return { status: "completed", statusKey: "completed", running: false };
  }

  if (approvalRequested) {
    return { status: "waiting_approval", statusKey: "waitingApproval", running: false };
  }

  const running =
    traceRunning ||
    partState === "input-streaming" ||
    (partState === "output-available" && preliminary) ||
    runningMarked;

  if (running) {
    return { status: "running", statusKey: "running", running: true };
  }
  return { status: "idle", statusKey: "pending", running: false };
}
