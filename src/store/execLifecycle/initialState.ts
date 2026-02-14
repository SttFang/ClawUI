import type { ExecLifecycleState } from "./types";

export const initialState: ExecLifecycleState = {
  recordsByKey: {},
  attemptIdByApprovalId: {},
  attemptIdByGatewayId: {},
  attemptIdByToolCallId: {},
  latestAttemptIdBySessionCommand: {},
};
