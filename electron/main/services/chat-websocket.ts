import { EventEmitter } from 'events'
import WebSocket from 'ws'
import { randomUUID } from 'crypto'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  sessionId: string
  message: string
  model?: string
}

export interface ChatStreamEvent {
  type: 'start' | 'delta' | 'end' | 'error'
  sessionId: string
  messageId: string
  content?: string
  error?: string
}

// OpenClaw ACP Protocol Types
interface ACPRequest {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

interface ACPResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { message: string; code?: string }
}

interface ACPEvent {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: number
}

type ACPMessage = ACPRequest | ACPResponse | ACPEvent

export class ChatWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null
  private gatewayUrl: string = 'ws://127.0.0.1:18789'
  private gatewayToken: string = ''
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private pendingRequests: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map()
  private connected = false

  setGatewayUrl(url: string): void {
    this.gatewayUrl = url
  }

  setGatewayToken(token: string): void {
    this.gatewayToken = token
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[ChatWebSocket] Connecting to:', this.gatewayUrl)
        this.ws = new WebSocket(this.gatewayUrl)

        this.ws.on('open', async () => {
          console.log('[ChatWebSocket] WebSocket opened, sending connect frame')
          try {
            await this.sendConnectFrame()
            this.connected = true
            this.reconnectAttempts = 0
            this.emit('connected')
            resolve()
          } catch (error) {
            console.error('[ChatWebSocket] Connect handshake failed:', error)
            this.ws?.close()
            reject(error)
          }
        })

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString())
        })

        this.ws.on('close', (code, reason) => {
          console.log(`[ChatWebSocket] Connection closed: ${code} - ${reason}`)
          this.connected = false
          this.emit('disconnected')
          // Reject all pending requests
          for (const [, { reject }] of this.pendingRequests) {
            reject(new Error('Connection closed'))
          }
          this.pendingRequests.clear()
          this.attemptReconnect()
        })

        this.ws.on('error', (error) => {
          console.error('[ChatWebSocket] WebSocket error:', error.message)
          this.emit('error', error.message)
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  private async sendConnectFrame(): Promise<void> {
    const connectId = randomUUID()

    const connectRequest: ACPRequest = {
      type: 'req',
      id: connectId,
      method: 'connect',
      params: {
        minProtocol: 1,
        maxProtocol: 3,
        client: {
          id: 'cli',  // Use CLI - trusted local client, no origin check needed
          version: '0.1.0',
          platform: process.platform,
          mode: 'cli',
        },
        auth: {
          token: this.gatewayToken,
        },
      },
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(connectId)
        reject(new Error('Connect timeout'))
      }, 10000)

      this.pendingRequests.set(connectId, {
        resolve: (response) => {
          clearTimeout(timeout)
          const res = response as ACPResponse
          if (res.ok) {
            console.log('[ChatWebSocket] Connected successfully')
            resolve()
          } else {
            reject(new Error(res.error?.message || 'Connect failed'))
          }
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
      })

      console.log('[ChatWebSocket] Sending connect frame:', JSON.stringify(connectRequest))
      this.ws?.send(JSON.stringify(connectRequest))
    })
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ACPMessage
      console.log('[ChatWebSocket] Received:', message.type, 'type' in message && message.type === 'event' ? (message as ACPEvent).event : '')

      if (message.type === 'res') {
        // Handle response to a request
        const response = message as ACPResponse
        const pending = this.pendingRequests.get(response.id)
        if (pending) {
          this.pendingRequests.delete(response.id)
          pending.resolve(response)
        }
      } else if (message.type === 'event') {
        // Handle server events
        const event = message as ACPEvent
        this.handleEvent(event)
      }
    } catch (e) {
      console.error('[ChatWebSocket] Failed to parse message:', e, data)
    }
  }

  private handleEvent(event: ACPEvent): void {
    // Map OpenClaw events to our ChatStreamEvent format
    switch (event.event) {
      case 'chat': {
        const payload = event.payload as {
          runId?: unknown
          sessionKey?: unknown
          state?: unknown
          message?: unknown
          errorMessage?: unknown
        }

        const runId = typeof payload?.runId === 'string' ? payload.runId : null
        const sessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : null
        const state = typeof payload?.state === 'string' ? payload.state : null

        if (!runId || !sessionKey || !state) return

        const extractText = (msg: unknown): string | null => {
          if (!msg) return null
          if (typeof msg === 'string') return msg
          if (typeof msg !== 'object') return null
          const content = (msg as { content?: unknown }).content
          if (!Array.isArray(content) || content.length === 0) return null
          const first = content[0] as { type?: unknown; text?: unknown } | undefined
          if (!first || typeof first !== 'object') return null
          const text = (first as { text?: unknown }).text
          return typeof text === 'string' ? text : null
        }

        if (state === 'delta') {
          const content = extractText(payload.message)
          if (content) {
            this.emit('stream', {
              type: 'delta',
              sessionId: sessionKey,
              messageId: runId,
              content,
            })
          }
          return
        }

        if (state === 'final') {
          const content = extractText(payload.message)
          if (content) {
            // Ensure the renderer sees the final full content before we end the stream.
            this.emit('stream', {
              type: 'delta',
              sessionId: sessionKey,
              messageId: runId,
              content,
            })
          }
          this.emit('stream', {
            type: 'end',
            sessionId: sessionKey,
            messageId: runId,
          })
          return
        }

        if (state === 'aborted') {
          this.emit('stream', {
            type: 'error',
            sessionId: sessionKey,
            messageId: runId,
            error: 'aborted',
          })
          return
        }

        if (state === 'error') {
          const errorMessage =
            typeof payload.errorMessage === 'string' ? payload.errorMessage : 'chat error'
          this.emit('stream', {
            type: 'error',
            sessionId: sessionKey,
            messageId: runId,
            error: errorMessage,
          })
          return
        }

        return
      }
      default:
        console.log('[ChatWebSocket] Unhandled event:', event.event)
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`[ChatWebSocket] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      setTimeout(() => {
        this.connect().catch(() => {})
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  async sendMessage(request: ChatRequest): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      throw new Error('WebSocket not connected')
    }

    // Use a stable runId/idempotency key so we can map streaming events back to a renderer message.
    const messageId = randomUUID()
    const requestId = randomUUID()

    // OpenClaw Gateway v2026 uses `chat.send` + `chat` events for streaming.
    const acpRequest: ACPRequest = {
      type: 'req',
      id: requestId,
      method: 'chat.send',
      params: {
        sessionKey: request.sessionId,
        message: request.message,
        deliver: false,
        idempotencyKey: messageId,
      },
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Request timeout'))
      }, 30000)

      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeout)
          const res = response as ACPResponse
          if (res.ok) {
            resolve(messageId)
          } else {
            reject(new Error(res.error?.message || 'Chat request failed'))
          }
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
      })

      this.ws?.send(JSON.stringify(acpRequest))
    })
  }

  disconnect(): void {
    this.connected = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN
  }
}

export const chatWebSocket = new ChatWebSocketService()
