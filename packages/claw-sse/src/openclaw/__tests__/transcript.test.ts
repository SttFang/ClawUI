import { describe, expect, it } from 'vitest'
import { openclawTranscriptToUIMessages } from '../../openclaw/transcript'

describe('openclawTranscriptToUIMessages', () => {
  it('should convert basic text blocks into UIMessage parts', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm1',
        role: 'assistant',
        content: [{ type: 'text', text: 'hello' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.role).toBe('assistant')
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('should keep assistant text for output_text style blocks', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm2',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'done from tool' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([{ type: 'text', text: 'done from tool' }])
  })

  it('should lift toolcall/toolresult blocks into dynamic-tool parts', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm1',
        role: 'assistant',
        toolCallId: 'tc1',
        content: [
          { type: 'toolcall', name: 'search', arguments: { q: 'claw' } },
          { type: 'toolresult', text: 'ok' },
        ],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'search',
        toolCallId: 'tc1',
        state: 'output-available',
        input: { q: 'claw' },
        output: 'ok',
        providerExecuted: true,
      },
    ])
  })

  it('should keep fallback message id stable when index shifts', () => {
    const record = {
      role: 'assistant',
      timestamp: 1739232000000,
      content: [{ type: 'text', text: 'same output' }],
    }

    const base = openclawTranscriptToUIMessages([record])[0]?.id
    const shifted = openclawTranscriptToUIMessages([
      { id: 'user-1', role: 'user', content: [{ type: 'text', text: 'hello' }] },
      record,
    ])[1]?.id

    expect(base).toBeTruthy()
    expect(shifted).toBeTruthy()
    expect(shifted).toBe(base)
  })

  it('should disambiguate duplicate direct message ids to avoid UI merge pollution', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'dup-id',
        role: 'assistant',
        content: [{ type: 'text', text: 'first' }],
      },
      {
        id: 'dup-id',
        role: 'assistant',
        content: [{ type: 'text', text: 'second' }],
      },
    ])

    expect(ui).toHaveLength(2)
    expect(ui[0]?.id).toBe('dup-id')
    expect(ui[1]?.id).toBe('dup-id:2')
  })

  it('should disambiguate duplicate fallback ids in one history batch', () => {
    const ts = 1739232000000
    const ui = openclawTranscriptToUIMessages([
      {
        role: 'assistant',
        timestamp: ts,
        content: [{ type: 'text', text: 'same content' }],
      },
      {
        role: 'assistant',
        timestamp: ts,
        content: [{ type: 'text', text: 'same content' }],
      },
    ])

    expect(ui).toHaveLength(2)
    expect(ui[0]?.id).toBeTruthy()
    expect(ui[1]?.id).toBeTruthy()
    expect(ui[1]?.id).not.toBe(ui[0]?.id)
  })

  it('should map toolResult role with result field into dynamic-tool output', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'tool-result-1',
        role: 'toolResult',
        toolCallId: 'tc-res-1',
        toolName: 'exec',
        result: { stdout: 'ok' },
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.role).toBe('assistant')
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'exec',
        toolCallId: 'tc-res-1',
        state: 'output-available',
        input: {},
        output: { stdout: 'ok' },
        providerExecuted: true,
      },
    ])
  })

  it('should extract text from tool_result content blocks', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm-tool-content',
        role: 'assistant',
        content: [
          { type: 'toolcall', name: 'read', arguments: { path: 'a.txt' } },
          {
            type: 'tool_result',
            content: [
              { type: 'text', text: 'line1' },
              { type: 'text', text: 'line2' },
            ],
          },
        ],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'read',
        toolCallId: 'm-tool-content',
        state: 'output-available',
        input: { path: 'a.txt' },
        output: 'line1\nline2',
        providerExecuted: true,
      },
    ])
  })

  it('should fallback exec output when tool result has no output payload', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm-tool-empty',
        role: 'toolResult',
        toolCallId: 'tc-empty',
        toolName: 'exec',
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'exec',
        toolCallId: 'tc-empty',
        state: 'output-available',
        input: {},
        output: 'No output - tool completed successfully.',
        providerExecuted: true,
      },
    ])
  })

  it('should preserve both text and tool result parts in one message', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm-tool-mixed',
        role: 'toolResult',
        toolCallId: 'tc-mixed',
        toolName: 'exec',
        content: [
          { type: 'text', text: '执行完成：' },
          { type: 'tool_result_error', text: 'permission denied' },
        ],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      { type: 'text', text: '执行完成：' },
      {
        type: 'dynamic-tool',
        toolName: 'exec',
        toolCallId: 'tc-mixed',
        state: 'output-available',
        input: {},
        output: 'permission denied',
        providerExecuted: true,
      },
    ])
  })

  it('should suppress redundant tool receipt text when tool output exists', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'm-tool-redundant',
        role: 'assistant',
        content: [
          { type: 'text', text: 'System: Exec finished (code 0)' },
          { type: 'tool_result', text: 'System: Exec finished (code 0)' },
        ],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'tool',
        toolCallId: 'm-tool-redundant',
        state: 'output-available',
        input: {},
        output: 'System: Exec finished (code 0)',
        providerExecuted: true,
      },
    ])
  })

  it('should use runId as toolCallId fallback when tool id is missing', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        role: 'toolResult',
        runId: 'run-fallback-id',
        toolName: 'exec',
        result: 'done',
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolName: 'exec',
        toolCallId: 'run-fallback-id',
        state: 'output-available',
        input: {},
        output: 'done',
        providerExecuted: true,
      },
    ])
  })

  it('should filter user messages from internal_system provenance', () => {
    const ui = openclawTranscriptToUIMessages([
      {
        id: 'u-internal',
        role: 'user',
        content: [{ type: 'text', text: 'internal tool handoff' }],
        inputProvenance: { kind: 'internal_system' },
      },
      {
        id: 'a1',
        role: 'assistant',
        content: [{ type: 'text', text: '继续执行完成。' }],
      },
    ])

    expect(ui).toHaveLength(1)
    expect(ui[0]?.id).toBe('a1')
    expect(ui[0]?.role).toBe('assistant')
  })
})
