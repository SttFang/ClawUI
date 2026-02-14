import type { DynamicToolUIPart } from "ai";
import { useShallow } from "zustand/react/shallow";
import { getCommandFromInput, makeExecApprovalKey } from "@/lib/exec";
import { useExecApprovalsStore } from "@/store/exec";

export type ExecApprovalAugmentation = {
  status: "pending_approval" | "running";
  approvalId?: string;
} | null;

export function useExecApprovalStatus(
  part: DynamicToolUIPart,
  sessionKey: string,
): ExecApprovalAugmentation {
  const [queue, runningByKey, lastResolvedBySession] = useExecApprovalsStore(
    useShallow((s) => [s.queue, s.runningByKey, s.lastResolvedBySession]),
  );

  // Terminal states don't need approval augmentation
  if (part.state === "output-available" || part.state === "output-error") return null;

  const command = getCommandFromInput(part.input);
  if (!command) return null;

  const key = makeExecApprovalKey(sessionKey, command);

  // Suppress stale approval if IPC already resolved
  const lastResolved = lastResolvedBySession[sessionKey];
  if (lastResolved && Date.now() - lastResolved.atMs < 5000) {
    const matching = queue.find(
      (e) => e.id === lastResolved.id && (e.request.command ?? "").trim() === command,
    );
    if (matching) return null;
  }

  // Already approved, waiting for gateway to start
  if (runningByKey[key]) return { status: "running" };

  // Pending in queue
  const pending = queue.find(
    (e) => e.request.sessionKey === sessionKey && (e.request.command ?? "").trim() === command,
  );
  if (pending) return { status: "pending_approval", approvalId: pending.id };

  return null;
}
