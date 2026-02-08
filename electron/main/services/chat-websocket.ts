import { EventEmitter } from 'events'
import WebSocket from 'ws'

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

export class ChatWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null
  private gatewayUrl: string = 'ws://127.0.0.1:18789'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  setGatewayUrl(url: string): void {
    this.gatewayUrl = url
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.gatewayUrl)

        this.ws.on('open', () => {
          this.reconnectAttempts = 0
          this.emit('connected')
          resolve()
        })

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const event = JSON.parse(data.toString()) as ChatStreamEvent
            this.emit('stream', event)
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e)
          }
        })

        this.ws.on('close', () => {
          this.emit('disconnected')
          this.attemptReconnect()
        })

        this.ws.on('error', (error) => {
          this.emit('error', error.message)
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        this.connect().catch(() => {})
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  async sendMessage(request: ChatRequest): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const payload = {
      type: 'chat',
      id: messageId,
      sessionId: request.sessionId,
      content: request.message,
      model: request.model,
    }

    this.ws.send(JSON.stringify(payload))
    return messageId
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const chatWebSocket = new ChatWebSocketService()
