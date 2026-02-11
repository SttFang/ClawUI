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
})
