import { create } from 'zustand'
import { ipc, type GatewayEventFrame } from '@/lib/ipc'

export type ExecApprovalDecision = 'allow-once' | 'allow-always' | 'deny'

export type ExecApprovalRequestPayload = {
  command: string
  cwd?: string | null
  host?: string | null
  security?: string | null
  ask?: string | null
  agentId?: string | null
  resolvedPath?: string | null
  sessionKey?: string | null
}

export type ExecApprovalRequest = {
  id: string
  request: ExecApprovalRequestPayload
  createdAtMs: number
  expiresAtMs: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseExecApprovalRequested(payload: unknown): ExecApprovalRequest | null {
  if (!isRecord(payload)) return null
  const id = typeof payload.id === 'string' ? payload.id.trim() : ''
  const request = payload.request
  if (!id || !isRecord(request)) return null

  const command = typeof request.command === 'string' ? request.command.trim() : ''
  if (!command) return null

  const createdAtMs = typeof payload.createdAtMs === 'number' ? payload.createdAtMs : 0
  const expiresAtMs = typeof payload.expiresAtMs === 'number' ? payload.expiresAtMs : 0
  if (!createdAtMs || !expiresAtMs) return null

  return {
    id,
    request: {
      command,
      cwd: typeof request.cwd === 'string' ? request.cwd : null,
      host: typeof request.host === 'string' ? request.host : null,
      security: typeof request.security === 'string' ? request.security : null,
      ask: typeof request.ask === 'string' ? request.ask : null,
      agentId: typeof request.agentId === 'string' ? request.agentId : null,
      resolvedPath: typeof request.resolvedPath === 'string' ? request.resolvedPath : null,
      sessionKey: typeof request.sessionKey === 'string' ? request.sessionKey : null,
    },
    createdAtMs,
    expiresAtMs,
  }
}

function parseExecApprovalResolved(payload: unknown): { id: string } | null {
  if (!isRecord(payload)) return null
  const id = typeof payload.id === 'string' ? payload.id.trim() : ''
  if (!id) return null
  return { id }
}

function prune(queue: ExecApprovalRequest[]): ExecApprovalRequest[] {
  const now = Date.now()
  return queue.filter((e) => e.expiresAtMs > now)
}

interface ExecApprovalsState {
  queue: ExecApprovalRequest[]
  busyById: Record<string, boolean>
}

interface ExecApprovalsActions {
  add: (entry: ExecApprovalRequest) => void
  remove: (id: string) => void
  resolve: (id: string, decision: ExecApprovalDecision) => Promise<void>
}

type ExecApprovalsStore = ExecApprovalsState & ExecApprovalsActions

export const useExecApprovalsStore = create<ExecApprovalsStore>((set) => ({
  queue: [],
  busyById: {},

  add: (entry) =>
    set((s) => {
      const next = prune(s.queue).filter((x) => x.id !== entry.id)
      next.push(entry)
      return { queue: next }
    }),

  remove: (id) =>
    set((s) => ({
      queue: prune(s.queue).filter((x) => x.id !== id),
    })),

  resolve: async (id, decision) => {
    set((s) => ({ busyById: { ...s.busyById, [id]: true } }))
    try {
      await ipc.chat.request("exec.approval.resolve", { id, decision })
    } finally {
      set((s) => {
        const { [id]: _ignored, ...rest } = s.busyById
        return { busyById: rest }
      })
    }
  },
}))

let listenerInitialized = false
export function initExecApprovalsListener() {
  if (listenerInitialized || typeof window === 'undefined') return
  listenerInitialized = true

  ipc.gateway.onEvent((evt: GatewayEventFrame) => {
    if (!evt || evt.type !== 'event') return

    if (evt.event === 'exec.approval.requested') {
      const entry = parseExecApprovalRequested(evt.payload)
      if (!entry) return
      useExecApprovalsStore.getState().add(entry)

      const delay = Math.max(0, entry.expiresAtMs - Date.now() + 500)
      window.setTimeout(() => {
        useExecApprovalsStore.getState().remove(entry.id)
      }, delay)
      return
    }

    if (evt.event === 'exec.approval.resolved') {
      const resolved = parseExecApprovalResolved(evt.payload)
      if (!resolved) return
      useExecApprovalsStore.getState().remove(resolved.id)
    }
  })
}
