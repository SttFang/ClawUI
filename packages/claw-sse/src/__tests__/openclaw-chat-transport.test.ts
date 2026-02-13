import { describe, it, expect, vi } from 'vitest'
import type { UIMessage } from 'ai'
import { createOpenClawChatTransport, type GatewayEventFrame } from '../openclaw-chat-transport'

function createUserMessage(text: string): UIMessage {
  return {
    id: 'u1',
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

async function readNext<T>(reader: ReadableStreamDefaultReader<T>): Promise<T> {
  const { value, done } = await reader.read()
  if (done) throw new Error('stream closed unexpectedly')
  return value
}

describe('createOpenClawChatTransport', () => {
  it('should emit suffix deltas from OpenClaw chat snapshot events', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'hello' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: 'hello' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 2,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'hello world' }] },
      },
    })

    const d2 = await readNext(reader)
    expect(d2).toEqual({ type: 'text-delta', id: 'text-1', delta: ' world' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 3,
        state: 'final',
        message: { content: [{ type: 'text', text: 'hello world' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')

    const last = await reader.read()
    expect(last.done).toBe(true)
  })

  it('should accept chat events even when gateway uses an internal runId', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          // clientRunId / idempotencyKey
          return 'client-1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    // Gateway emits chat events keyed by internal runId (not equal to idempotencyKey).
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-1',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'hello' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: 'hello' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-1',
        sessionKey: 's1',
        seq: 2,
        state: 'final',
        message: { content: [{ type: 'text', text: 'hello' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')

    const last = await reader.read()
    expect(last.done).toBe(true)
  })

  it('should ignore unrelated internal chat run when seq is too old', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'client-1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    // Unrelated old run should be ignored.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-old',
        sessionKey: 's1',
        seq: 99,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'stale' }] },
      },
    })

    // Current run should still work.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'client-1',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'fresh' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: 'fresh' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'client-1',
        sessionKey: 's1',
        seq: 2,
        state: 'final',
        message: { content: [{ type: 'text', text: 'fresh' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)
  })

  it('should ignore unrelated non-client chat run before current run is observed', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'client-1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    // A different run from the same session arrives first; this must not bind.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'stale-run',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'stale text' }] },
      },
    })

    // Current run still needs to render normally.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'client-1',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'fresh text' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: 'fresh text' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'client-1',
        sessionKey: 's1',
        seq: 2,
        state: 'final',
        message: { content: [{ type: 'text', text: 'fresh text' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)
  })

  it('should bind resumed internal run quickly after approval activity', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'client-approval-2'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('需要审批后再执行')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'exec.approval.requested',
      payload: {
        id: 'approval-1',
        request: { sessionKey: 's1', command: 'echo ok' },
        createdAtMs: Date.now(),
        expiresAtMs: Date.now() + 60_000,
      },
    })

    // After approval, some gateways resume on a non-client runId with high seq.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-after-approval',
        sessionKey: 's1',
        seq: 42,
        state: 'delta',
        message: { content: [{ type: 'text', text: '审批完成，继续执行。' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: '审批完成，继续执行。' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-after-approval',
        sessionKey: 's1',
        seq: 43,
        state: 'final',
        message: { content: [{ type: 'text', text: '审批完成，继续执行。' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)
  })

  it('should continue streaming when post-approval chat switches runId after early client delta', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'client-approval-switch'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('先执行再审批')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    // First delta arrives on clientRunId before approval.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'client-approval-switch',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: '我先检查一下。' }] },
      },
    })

    expect(await readNext(reader)).toEqual({ type: 'text-delta', id: 'text-1', delta: '我先检查一下。' })

    handler?.({
      type: 'event',
      event: 'exec.approval.requested',
      payload: {
        id: 'approval-switch-1',
        request: { sessionKey: 's1', command: 'ls -la' },
        createdAtMs: Date.now(),
        expiresAtMs: Date.now() + 60_000,
      },
    })

    // After approval, gateway resumes on an internal runId.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-after-approval-switch',
        sessionKey: 's1',
        seq: 52,
        state: 'delta',
        message: { content: [{ type: 'text', text: '我先检查一下。\n审批通过，继续执行。' }] },
      },
    })

    expect(await readNext(reader)).toEqual({
      type: 'text-delta',
      id: 'text-1',
      delta: '\n审批通过，继续执行。',
    })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-after-approval-switch',
        sessionKey: 's1',
        seq: 53,
        state: 'final',
        message: { content: [{ type: 'text', text: '我先检查一下。\n审批通过，继续执行。' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)
  })

  it('should rebind to continuation snapshot runId even without explicit approval event', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'client-switch-no-approval'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('继续执行')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'client-switch-no-approval',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: '第一段输出' }] },
      },
    })
    expect(await readNext(reader)).toEqual({ type: 'text-delta', id: 'text-1', delta: '第一段输出' })

    // Simulate gateway switching to an internal run id and sending a full snapshot continuation.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-switch-no-approval',
        sessionKey: 's1',
        seq: 61,
        state: 'delta',
        message: { content: [{ type: 'text', text: '第一段输出\n第二段输出' }] },
      },
    })

    expect(await readNext(reader)).toEqual({
      type: 'text-delta',
      id: 'text-1',
      delta: '\n第二段输出',
    })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-switch-no-approval',
        sessionKey: 's1',
        seq: 62,
        state: 'final',
        message: { content: [{ type: 'text', text: '第一段输出\n第二段输出' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)
  })

  it('should still bind internal run after long approval pause', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'client-approval-1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('需要审批后再执行')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    // Simulate long human approval wait.
    await vi.advanceTimersByTimeAsync(65_000)

    // Gateway resumes with an internal runId and a high seq.
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-after-approval',
        sessionKey: 's1',
        seq: 42,
        state: 'delta',
        message: { content: [{ type: 'text', text: '审批完成，继续执行。' }] },
      },
    })

    const delta = await readNext(reader)
    expect(delta).toEqual({ type: 'text-delta', id: 'text-1', delta: '审批完成，继续执行。' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'internal-after-approval',
        sessionKey: 's1',
        seq: 43,
        state: 'final',
        message: { content: [{ type: 'text', text: '审批完成，继续执行。' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)
    vi.useRealTimers()
  })

  it('should map OpenClaw tool events into AI SDK tool chunks', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('run a tool')],
      abortSignal: undefined,
    })
    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 10,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'start',
          name: 'search',
          toolCallId: 'tc1',
          args: { q: 'claw' },
          meta: 'Search',
        },
      },
    })

    const toolStart = await readNext(reader)
    expect(toolStart).toMatchObject({
      type: 'tool-input-available',
      toolCallId: 'tc1',
      toolName: 'search',
      providerExecuted: true,
      input: { q: 'claw' },
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 10,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'update',
          name: 'search',
          toolCallId: 'tc1',
          partialResult: { items: [1] },
        },
      },
    })

    const toolUpdate = await readNext(reader)
    expect(toolUpdate).toMatchObject({
      type: 'tool-output-available',
      toolCallId: 'tc1',
      preliminary: true,
      output: { items: [1] },
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 11,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'result',
          name: 'search',
          toolCallId: 'tc1',
          result: { ok: true },
          isError: false,
        },
      },
    })

    const toolResult = await readNext(reader)
    expect(toolResult).toMatchObject({
      type: 'tool-output-available',
      toolCallId: 'tc1',
      providerExecuted: true,
      output: { ok: true },
    })

    // Finish via lifecycle as a safety net.
    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 12,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })

    // lifecycle event is forwarded as a data chunk (A2UI can render it).
    expect((await readNext(reader)).type).toBe('data-openclaw-lifecycle')

    // Without chat.final, lifecycle=end triggers a delayed fallback finish (longer than the old 1.5s cutoff).
    await vi.advanceTimersByTimeAsync(21_500)

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')

    vi.useRealTimers()
  })

  it('should accept tool_use_id alias in OpenClaw tool events', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run-tool-use'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('run tool alias')],
      abortSignal: undefined,
    })
    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-tool-use',
        seq: 1,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'start',
          name: 'read',
          tool_use_id: 'tc-use-1',
          args: { path: 'app/page.tsx' },
        },
      },
    })

    expect(await readNext(reader)).toMatchObject({
      type: 'tool-input-available',
      toolCallId: 'tc-use-1',
      toolName: 'read',
      providerExecuted: true,
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-tool-use',
        seq: 2,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'result',
          name: 'read',
          tool_use_id: 'tc-use-1',
          result: { ok: true },
          isError: false,
        },
      },
    })

    expect(await readNext(reader)).toMatchObject({
      type: 'tool-output-available',
      toolCallId: 'tc-use-1',
      providerExecuted: true,
      output: { ok: true },
    })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run-tool-use',
        sessionKey: 's1',
        seq: 3,
        state: 'final',
        message: { content: [{ type: 'text', text: 'done' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-delta')
    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)
    vi.useRealTimers()
  })

  it('should not finish early on lifecycle=end while a tool is running', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('run exec')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    // Tool starts, then lifecycle=end arrives before the final chat token.
    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 10,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'start',
          name: 'exec',
          toolCallId: 'tc1',
          args: { command: 'openclaw config --help' },
          meta: 'exec',
        },
      },
    })
    expect((await readNext(reader)).type).toBe('tool-input-available')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 11,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })

    // Advance time beyond the old 1.5s cutoff; stream must still be open.
    await vi.advanceTimersByTimeAsync(5000)
    const probe = await reader.read()
    expect(probe.done).toBe(false)

    // Tool finishes later, then chat.final arrives.
    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 12,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'result',
          name: 'exec',
          toolCallId: 'tc1',
          result: { code: 0 },
          isError: false,
        },
      },
    })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 20,
        state: 'final',
        message: { content: [{ type: 'text', text: 'done' }] },
      },
    })

    // Drain until finish.
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value && typeof value === 'object' && (value as { type?: unknown }).type === 'finish') {
        break
      }
    }

    vi.useRealTimers()
  })

  it('should clear running tool on phase=end and finish via lifecycle fallback', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('run exec')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 10,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'start',
          name: 'exec',
          toolCallId: 'tc-end-only',
          args: { command: 'claude --help' },
          meta: 'exec',
        },
      },
    })
    expect((await readNext(reader)).type).toBe('tool-input-available')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 11,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })
    expect((await readNext(reader)).type).toBe('data-openclaw-lifecycle')

    // Tool completes with phase=end but no result payload.
    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 12,
        stream: 'tool',
        ts: Date.now(),
        data: {
          phase: 'end',
          name: 'exec',
          toolCallId: 'tc-end-only',
        },
      },
    })

    expect(await readNext(reader)).toEqual({
      type: 'tool-output-available',
      toolCallId: 'tc-end-only',
      output: 'No output - tool completed successfully.',
      providerExecuted: true,
      dynamic: true,
    })

    await vi.advanceTimersByTimeAsync(21_500)

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)

    vi.useRealTimers()
  })

  it('should ignore agent assistant stream for text and rely on chat.delta snapshots', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 1,
        stream: 'assistant',
        ts: Date.now(),
        data: { text: 'hello', delta: 'hello' },
      },
    })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 2,
        state: 'final',
        message: { content: [{ type: 'text', text: 'hello world' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: 'hello world' })
  })

  it('should fallback to assistant stream text when chat events are missing', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run-assistant-only'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hello')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-assistant-only',
        sessionKey: 's1',
        seq: 1,
        stream: 'assistant',
        ts: Date.now(),
        data: { text: 'hello from assistant stream' },
      },
    })
    await vi.advanceTimersByTimeAsync(350)

    expect(await readNext(reader)).toEqual({
      type: 'text-delta',
      id: 'text-1',
      delta: 'hello from assistant stream',
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-assistant-only',
        sessionKey: 's1',
        seq: 2,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })
    expect((await readNext(reader)).type).toBe('data-openclaw-lifecycle')

    await vi.advanceTimersByTimeAsync(21_500)

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)

    vi.useRealTimers()
  })

  it('should drop assistant fallback text from non-current run', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run-current'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hello')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-other',
        sessionKey: 's1',
        seq: 1,
        stream: 'assistant',
        ts: Date.now(),
        data: { text: 'stale other run text' },
      },
    })
    await vi.advanceTimersByTimeAsync(350)

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run-current',
        sessionKey: 's1',
        seq: 2,
        state: 'final',
        message: { content: [{ type: 'text', text: 'fresh current run text' }] },
      },
    })

    expect(await readNext(reader)).toEqual({
      type: 'text-delta',
      id: 'text-1',
      delta: 'fresh current run text',
    })
    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)

    vi.useRealTimers()
  })

  it('should ignore stale buffered agent events from previous runs', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run-fresh'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hello')],
      abortSignal: undefined,
    })

    const staleTs = Date.now() - 60_000
    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-stale',
        sessionKey: 's1',
        seq: 1,
        stream: 'lifecycle',
        ts: staleTs,
        data: { phase: 'start' },
      },
    })
    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-stale',
        sessionKey: 's1',
        seq: 2,
        stream: 'assistant',
        ts: staleTs,
        data: { text: 'stale assistant text' },
      },
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    await vi.advanceTimersByTimeAsync(350)

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run-fresh',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: 'fresh text' }] },
      },
    })

    expect(await readNext(reader)).toEqual({ type: 'text-delta', id: 'text-1', delta: 'fresh text' })

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run-fresh',
        sessionKey: 's1',
        seq: 2,
        state: 'final',
        message: { content: [{ type: 'text', text: 'fresh text' }] },
      },
    })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)

    vi.useRealTimers()
  })

  it('should not append divergent assistant fallback snapshots', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run-assistant-divergent'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hello')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    const ts = Date.now()
    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-assistant-divergent',
        sessionKey: 's1',
        seq: 1,
        stream: 'assistant',
        ts,
        data: { text: 'System: Exec finished (code 0)' },
      },
    })
    await vi.advanceTimersByTimeAsync(350)

    expect(await readNext(reader)).toEqual({
      type: 'text-delta',
      id: 'text-1',
      delta: 'System: Exec finished (code 0)',
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-assistant-divergent',
        sessionKey: 's1',
        seq: 2,
        stream: 'assistant',
        ts: ts + 1,
        data: { text: '现在有了，截图已成功生成，文件路径如下。' },
      },
    })
    await vi.advanceTimersByTimeAsync(350)

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-assistant-divergent',
        sessionKey: 's1',
        seq: 3,
        stream: 'lifecycle',
        ts: ts + 2,
        data: { phase: 'end' },
      },
    })

    expect((await readNext(reader)).type).toBe('data-openclaw-lifecycle')
    await vi.advanceTimersByTimeAsync(21_500)
    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)

    vi.useRealTimers()
  })

  it('should append divergent assistant fallback text after approval activity', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run-assistant-approval'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hello')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()
    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    const ts = Date.now()
    handler?.({
      type: 'event',
      event: 'exec.approval.requested',
      payload: {
        id: 'approval-a1',
        request: { sessionKey: 's1', command: 'openclaw status' },
        createdAtMs: ts,
        expiresAtMs: ts + 60_000,
      },
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-assistant-approval',
        sessionKey: 's1',
        seq: 1,
        stream: 'assistant',
        ts,
        data: { text: 'System: Exec finished (code 0)' },
      },
    })
    await vi.advanceTimersByTimeAsync(350)

    expect(await readNext(reader)).toEqual({
      type: 'text-delta',
      id: 'text-1',
      delta: 'System: Exec finished (code 0)',
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-assistant-approval',
        sessionKey: 's1',
        seq: 2,
        stream: 'assistant',
        ts: ts + 1,
        data: { text: '状态检查已完成，服务运行正常。' },
      },
    })
    await vi.advanceTimersByTimeAsync(350)

    expect(await readNext(reader)).toEqual({
      type: 'text-delta',
      id: 'text-1',
      delta: '\n\n状态检查已完成，服务运行正常。',
    })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run-assistant-approval',
        sessionKey: 's1',
        seq: 3,
        stream: 'lifecycle',
        ts: ts + 2,
        data: { phase: 'end' },
      },
    })

    expect((await readNext(reader)).type).toBe('data-openclaw-lifecycle')
    await vi.advanceTimersByTimeAsync(21_500)
    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
    expect((await reader.read()).done).toBe(true)

    vi.useRealTimers()
  })

  it('should wait for chat.final if lifecycle end arrives first (avoid truncation)', async () => {
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 1,
        state: 'delta',
        message: { content: [{ type: 'text', text: '你好 Steven，' }] },
      },
    })

    const d1 = await readNext(reader)
    expect(d1).toEqual({ type: 'text-delta', id: 'text-1', delta: '你好 Steven，' })

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 1,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })

    // lifecycle event is forwarded as a data chunk (A2UI can render it).
    expect((await readNext(reader)).type).toBe('data-openclaw-lifecycle')

    // If we finished immediately here, we'd miss the trailing chat.final payload (truncation bug).
    handler?.({
      type: 'event',
      event: 'chat',
      payload: {
        runId: 'run1',
        sessionKey: 's1',
        seq: 2,
        state: 'final',
        message: { content: [{ type: 'text', text: '你好 Steven，我在。今晚想让我帮你做点什么？' }] },
      },
    })

    const d2 = await readNext(reader)
    expect(d2).toEqual({ type: 'text-delta', id: 'text-1', delta: '我在。今晚想让我帮你做点什么？' })

    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')
  })

  it('should finish when agent lifecycle ends even without chat.final (delayed fallback)', async () => {
    vi.useFakeTimers()
    let handler: ((frame: GatewayEventFrame) => void) | null = null

    const transport = createOpenClawChatTransport({
      sessionKey: 's1',
      adapter: {
        onGatewayEvent(h) {
          handler = h
          return () => {
            handler = null
          }
        },
        async sendChat() {
          return 'run1'
        },
      },
    })

    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'c1',
      messageId: undefined,
      messages: [createUserMessage('hi')],
      abortSignal: undefined,
    })

    const reader = stream.getReader()

    expect((await readNext(reader)).type).toBe('start')
    expect((await readNext(reader)).type).toBe('start-step')
    expect((await readNext(reader)).type).toBe('text-start')

    handler?.({
      type: 'event',
      event: 'agent',
      payload: {
        runId: 'run1',
        seq: 1,
        stream: 'lifecycle',
        ts: Date.now(),
        data: { phase: 'end' },
      },
    })

    expect((await readNext(reader)).type).toBe('data-openclaw-lifecycle')
    await vi.advanceTimersByTimeAsync(21_500)
    expect((await readNext(reader)).type).toBe('text-end')
    expect((await readNext(reader)).type).toBe('finish-step')
    expect((await readNext(reader)).type).toBe('finish')

    vi.useRealTimers()
  })
})
