import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface OpenClawConfig {
  gateway: {
    port: number
    bind: string
    token: string
  }
  env?: Record<string, string>
}

export class GatewayService extends EventEmitter {
  private process: ChildProcess | null = null
  private status: GatewayStatus = 'stopped'
  private config: OpenClawConfig | null = null
  private port = 18789

  setConfig(config: OpenClawConfig): void {
    this.config = config
    if (config.gateway?.port) {
      this.port = config.gateway.port
    }
  }

  getStatus(): GatewayStatus {
    return this.status
  }

  getPort(): number {
    return this.port
  }

  getWebSocketUrl(): string {
    return `ws://localhost:${this.port}`
  }

  async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      return
    }

    this.setStatus('starting')

    try {
      // Build environment variables
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ...(this.config?.env || {}),
      }

      // Set gateway token if configured
      if (this.config?.gateway?.token) {
        env.OPENCLAW_GATEWAY_TOKEN = this.config.gateway.token
      }

      // Start OpenClaw Gateway as subprocess
      this.process = spawn('openclaw', ['gateway', '--port', String(this.port)], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      this.process.stdout?.on('data', (data) => {
        const output = data.toString()
        console.log('[Gateway]', output)
        // Check for startup message
        if (output.includes('listening') || output.includes('started')) {
          this.setStatus('running')
        }
      })

      this.process.stderr?.on('data', (data) => {
        console.error('[Gateway Error]', data.toString())
      })

      this.process.on('error', (error) => {
        console.error('[Gateway] Failed to start:', error)
        this.setStatus('error')
      })

      this.process.on('exit', (code, signal) => {
        console.log(`[Gateway] Process exited with code ${code}, signal ${signal}`)
        if (this.status !== 'stopped') {
          this.setStatus('stopped')
        }
        this.process = null
      })

      // Wait a bit for the process to start
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // If not already running or errored, assume it's running
      const currentStatus = this.getStatus()
      if (currentStatus !== 'running' && currentStatus !== 'error' && currentStatus !== 'stopped') {
        this.setStatus('running')
      }
    } catch (error) {
      console.error('[Gateway] Failed to start:', error)
      this.setStatus('error')
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.process) {
      this.setStatus('stopped')
      return
    }

    return new Promise((resolve) => {
      if (!this.process) {
        this.setStatus('stopped')
        resolve()
        return
      }

      this.process.once('exit', () => {
        this.setStatus('stopped')
        this.process = null
        resolve()
      })

      // Try graceful shutdown first
      this.process.kill('SIGTERM')

      // Force kill after timeout
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL')
        }
      }, 5000)
    })
  }

  private setStatus(status: GatewayStatus): void {
    this.status = status
    this.emit('status-changed', status)
  }
}
