import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { app } from 'electron'
import { existsSync } from 'fs'
import path from 'path'

export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface OpenClawConfig {
  gateway: {
    mode?: 'local' | 'remote'
    port: number
    bind: string
    auth?: {
      mode: 'token' | 'none'
      token: string
    }
  }
  env?: Record<string, string>
}

export class GatewayService extends EventEmitter {
  private process: ChildProcess | null = null
  private status: GatewayStatus = 'stopped'
  private config: OpenClawConfig | null = null
  private port = 18789
  private runtimeDir = path.join(app.getPath('userData'), 'runtime')

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

  /**
   * Get the path to the openclaw CLI.
   * Priority: embedded > global
   */
  private getOpenClawCommand(): { command: string; args: string[] } {
    // Check for embedded OpenClaw (installed via npm in runtime dir)
    const embeddedBinPath = path.join(this.runtimeDir, 'node_modules', '.bin', 'openclaw')
    if (existsSync(embeddedBinPath)) {
      console.log('[Gateway] Using embedded OpenClaw:', embeddedBinPath)
      return { command: embeddedBinPath, args: [] }
    }

    // Check for embedded OpenClaw package and run via node
    const embeddedPkgPath = path.join(this.runtimeDir, 'node_modules', 'openclaw', 'dist', 'cli.js')
    if (existsSync(embeddedPkgPath)) {
      console.log('[Gateway] Using embedded OpenClaw via node:', embeddedPkgPath)
      return { command: 'node', args: [embeddedPkgPath] }
    }

    // Fallback to global openclaw command
    console.log('[Gateway] Using global OpenClaw command')
    return { command: 'openclaw', args: [] }
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

      // Set gateway token if configured (new format: gateway.auth.token)
      if (this.config?.gateway?.auth?.token) {
        env.OPENCLAW_GATEWAY_TOKEN = this.config.gateway.auth.token
      }

      // Get the openclaw command (embedded or global)
      const { command, args } = this.getOpenClawCommand()
      const fullArgs = [...args, 'gateway', '--port', String(this.port)]

      console.log('[Gateway] Starting:', command, fullArgs.join(' '))

      // Start OpenClaw Gateway as subprocess
      this.process = spawn(command, fullArgs, {
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
