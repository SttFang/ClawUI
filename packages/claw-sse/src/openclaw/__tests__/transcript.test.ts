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
        dynamic: true,
        providerExecuted: true,
      },
    ])
  })
})

