import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFinishPolicy, type FinishPolicyCallbacks } from '../finish-policy'

function makeCallbacks(overrides?: Partial<FinishPolicyCallbacks>): FinishPolicyCallbacks & {
  chunks: unknown[]
  controllerClosed: boolean
  unsubscribeCalled: boolean
  externalTimersCancelled: boolean
} {
  const chunks: unknown[] = []
  const state = { controllerClosed: false, unsubscribeCalled: false, externalTimersCancelled: false }
  return {
    chunks,
    get controllerClosed() { return state.controllerClosed },
    get unsubscribeCalled() { return state.unsubscribeCalled },
    get externalTimersCancelled() { return state.externalTimersCancelled },
    hasActiveTextPart: () => false,
    activeTextPartId: () => 'text-1',
    cancelExternalTimers: () => { state.externalTimersCancelled = true },
    unsubscribe: () => { state.unsubscribeCalled = true },
    enqueue: (chunk: unknown) => { chunks.push(chunk) },
    closeController: () => { state.controllerClosed = true },
    ...overrides,
  }
}

describe('FinishPolicy', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts unfinished and unclosed', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    expect(policy.isFinished).toBe(false)
    expect(policy.isClosed).toBe(false)
  })

  it('onChatFinal finishes and closes', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onChatFinal()
    expect(policy.isFinished).toBe(true)
    expect(policy.isClosed).toBe(true)
    expect(cb.chunks).toContainEqual({ type: 'finish' })
    expect(cb.controllerClosed).toBe(true)
  })

  it('onChatFinal is idempotent', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onChatFinal()
    policy.onChatFinal()
    expect(cb.chunks.filter(c => (c as { type: string }).type === 'finish')).toHaveLength(1)
  })

  it('onChatAborted emits abort + finish', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onChatAborted('test')
    expect(cb.chunks).toContainEqual({ type: 'abort', reason: 'test' })
    expect(cb.chunks).toContainEqual({ type: 'finish', finishReason: 'stop' })
    expect(policy.isFinished).toBe(true)
  })

  it('onChatError emits error and closes', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onChatError('boom')
    expect(cb.chunks).toContainEqual({ type: 'error', errorText: 'boom' })
    expect(policy.isClosed).toBe(true)
  })

  it('closes active text part on finish', () => {
    const cb = makeCallbacks({ hasActiveTextPart: () => true, activeTextPartId: () => 'text-3' })
    const policy = createFinishPolicy(cb)
    policy.onChatFinal()
    expect(cb.chunks[0]).toEqual({ type: 'text-end', id: 'text-3' })
  })

  it('onUserAbort without clientRunId finishes immediately', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    const abortChat = vi.fn()
    policy.onUserAbort(abortChat)
    expect(abortChat).not.toHaveBeenCalled()
    expect(policy.isFinished).toBe(true)
  })

  it('onUserAbort with clientRunId calls abortChat then finishes', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.setClientRunId('run-1')
    const abortChat = vi.fn()
    policy.onUserAbort(abortChat)
    expect(abortChat).toHaveBeenCalled()
    expect(policy.isFinished).toBe(true)
  })

  it('tracks pending tools', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    expect(policy.hasPendingTools).toBe(false)
    policy.addPendingTool('tc-1')
    expect(policy.hasPendingTools).toBe(true)
    policy.removePendingTool('tc-1')
    expect(policy.hasPendingTools).toBe(false)
  })

  it('onLifecycleEnd defers finish with timer', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onLifecycleEnd()
    expect(policy.isFinished).toBe(false)
    // After 1500ms the timer fires but sinceEndMs < 20_000, so it reschedules
    vi.advanceTimersByTime(1500)
    expect(policy.isFinished).toBe(false)
    // After 20s total it finishes
    vi.advanceTimersByTime(20_000)
    expect(policy.isFinished).toBe(true)
  })

  it('onChatDeltaOrFinal cancels lifecycle finish timer', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onLifecycleEnd()
    vi.advanceTimersByTime(500)
    policy.onChatDeltaOrFinal()
    vi.advanceTimersByTime(30_000)
    // The timer was cancelled so we remain unfinished after the tick
    // (timer was cleared, but the lifecycle timer callback also checks idleForMs)
    expect(policy.isFinished).toBe(false)
  })

  it('lifecycle finish waits for pending tools', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.addPendingTool('tc-1')
    policy.onLifecycleEnd()
    vi.advanceTimersByTime(25_000)
    expect(policy.isFinished).toBe(false)
    policy.removePendingTool('tc-1')
    vi.advanceTimersByTime(25_000)
    expect(policy.isFinished).toBe(true)
  })

  it('unsubscribes and cancels external timers on finish', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onChatFinal()
    expect(cb.unsubscribeCalled).toBe(true)
    expect(cb.externalTimersCancelled).toBe(true)
  })

  describe('disconnect/reconnect', () => {
    it('onDisconnected starts timeout, onReconnected cancels and finishes', () => {
      const cb = makeCallbacks()
      const policy = createFinishPolicy(cb)
      policy.setClientRunId('run-1')
      policy.onDisconnected(15_000)
      expect(policy.isClosed).toBe(false)
      // Reconnect before timeout
      policy.onReconnected()
      expect(policy.isFinished).toBe(true)
      expect(policy.isClosed).toBe(true)
      expect(cb.chunks).not.toContainEqual(expect.objectContaining({ type: 'error' }))
      expect(cb.chunks).toContainEqual({ type: 'finish' })
    })

    it('onDisconnected times out to error after deadline', () => {
      const cb = makeCallbacks()
      const policy = createFinishPolicy(cb)
      policy.setClientRunId('run-1')
      policy.onDisconnected(15_000)
      vi.advanceTimersByTime(15_000)
      expect(policy.isClosed).toBe(true)
      expect(cb.chunks).toContainEqual({ type: 'error', errorText: 'Gateway disconnected' })
    })

    it('onDisconnected is no-op when already closed', () => {
      const cb = makeCallbacks()
      const policy = createFinishPolicy(cb)
      policy.onChatFinal()
      policy.onDisconnected(15_000)
      vi.advanceTimersByTime(15_000)
      // Only one close
      expect(cb.chunks.filter(c => (c as { type: string }).type === 'finish')).toHaveLength(1)
    })

    it('onReconnected is no-op when not disconnected', () => {
      const cb = makeCallbacks()
      const policy = createFinishPolicy(cb)
      policy.onReconnected()
      expect(policy.isFinished).toBe(false)
      expect(policy.isClosed).toBe(false)
    })
  })
})
