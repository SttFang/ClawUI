import type {
  ChatNormalizedApprovalDecision,
  ChatNormalizedCorrelationConfidence,
  ChatNormalizedEventSource,
} from "./common";
import type { ChatNormalizedRunEventKind } from "./kinds";
import type { ChatRunStatus } from "./status";

export interface ChatNormalizedRunEvent {
  kind: ChatNormalizedRunEventKind;
  traceId: string;
  timestampMs: number;
  sessionKey: string;
  clientRunId: string;
  agentRunId?: string;
  source?: ChatNormalizedEventSource;
  correlationConfidence?: ChatNormalizedCorrelationConfidence;
  approvalId?: string;
  command?: string;
  decision?: ChatNormalizedApprovalDecision;
  status?: ChatRunStatus;
  text?: string;
  error?: string;
  rawEventName?: string;
  rawSeq?: number;
  metadata?: Record<string, unknown>;
}
