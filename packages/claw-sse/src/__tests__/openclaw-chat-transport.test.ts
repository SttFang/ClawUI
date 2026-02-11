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
