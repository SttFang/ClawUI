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
        maxProtocol: 1,
        client: {
          id: 'cli',  // Must be 'cli' for operator connections
          version: '0.1.0',
          platform: process.platform,
          mode: 'operator',
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
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
      case 'agent:stream:start': {
        const payload = event.payload as { sessionId: string; messageId: string }
        this.emit('stream', {
          type: 'start',
          sessionId: payload.sessionId,
          messageId: payload.messageId,
        })
        break
      }
      case 'agent:stream:delta': {
        const payload = event.payload as { sessionId: string; messageId: string; content: string }
        this.emit('stream', {
          type: 'delta',
          sessionId: payload.sessionId,
          messageId: payload.messageId,
          content: payload.content,
        })
        break
      }
      case 'agent:stream:end': {
        const payload = event.payload as { sessionId: string; messageId: string }
        this.emit('stream', {
          type: 'end',
          sessionId: payload.sessionId,
          messageId: payload.messageId,
        })
        break
      }
      case 'agent:stream:error': {
        const payload = event.payload as { sessionId: string; messageId: string; error: string }
        this.emit('stream', {
          type: 'error',
          sessionId: payload.sessionId,
          messageId: payload.messageId,
          error: payload.error,
        })
        break
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

    const messageId = randomUUID()
    const requestId = randomUUID()

    // Use OpenClaw ACP protocol format
    const acpRequest: ACPRequest = {
      type: 'req',
      id: requestId,
      method: 'agent.chat',
      params: {
        sessionId: request.sessionId,
        message: request.message,
        model: request.model,
        messageId,
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
