import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import net from 'net'
import { buildLoginShellInvocation, execInLoginShell } from '../utils/login-shell'
import { gatewayLog } from '../lib/logger'

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
  private monitorTimer: NodeJS.Timeout | null = null

  setConfig(config: OpenClawConfig): void {
    this.config = config
    if (config.gateway?.port) {
      this.port = config.gateway.port
    }

    // Start monitoring as soon as we know which port to watch.
    this.ensureMonitoring()
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

  private ensureMonitoring(): void {
    if (this.monitorTimer) return

    // Lightweight reachability check. This lets us reflect external starts/stops
    // (e.g. user manages gateway via `openclaw gateway install/stop`) in the UI.
    this.monitorTimer = setInterval(() => {
      this.refreshReachability().catch(() => {})
    }, 3_000)
  }

  private async refreshReachability(): Promise<void> {
    // Only auto-flip between running/stopped when not in the middle of a managed transition.
    if (this.status === 'starting' || this.status === 'error') return

    const reachable = await this.isGatewayReachable()
    if (reachable && this.status !== 'running') {
      this.setStatus('running')
      return
    }
    if (!reachable && this.status === 'running') {
      this.setStatus('stopped')
    }
  }

  private async isGatewayReachable(): Promise<boolean> {
    // TCP connect is enough to know if something is listening.
    // We avoid ACP auth handshakes here to keep monitoring cheap.
    const host = '127.0.0.1'
    const port = this.port

    return await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port })
      const done = (ok: boolean) => {
        socket.removeAllListeners()
        socket.destroy()
        resolve(ok)
      }

      socket.setTimeout(750)
      socket.once('connect', () => done(true))
      socket.once('timeout', () => done(false))
      socket.once('error', () => done(false))
    })
  }

  async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      return
    }

    const t0 = Date.now()
    this.setStatus('starting')

    try {
      // If a gateway is already running (maybe started outside ClawUI), just mark it running.
      if (await this.isGatewayReachable()) {
        gatewayLog.info('[gateway.started]', `port=${this.port}`, 'source=external', `durationMs=${Date.now() - t0}`)
        this.setStatus('running')
        return
      }

      // Build environment variables
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ...(this.config?.env || {}),
      }

      // Set gateway token if configured (new format: gateway.auth.token)
      if (this.config?.gateway?.auth?.token) {
        env.OPENCLAW_GATEWAY_TOKEN = this.config.gateway.auth.token
      }

      // Run via a login shell so PATH matches the user's terminal environment.
      // This is important on macOS where GUI apps often have a minimal PATH.
      const gatewayCmd = `openclaw gateway --port ${this.port}`
      const { file: command, args: fullArgs } = buildLoginShellInvocation(gatewayCmd)

      gatewayLog.info('[gateway.spawn]', command, fullArgs.join(' '))

      // Start OpenClaw Gateway as subprocess
      this.process = spawn(command, fullArgs, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      this.process.stdout?.on('data', (data) => {
        const output = data.toString()
        // Strip OpenClaw's own timestamp prefix to avoid double timestamps
        const stripped = output.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/gm, '').trimEnd()
        if (stripped) gatewayLog.debug(stripped)
        // Check for startup message
        if (output.includes('listening') || output.includes('started')) {
          this.setStatus('running')
        }
      })

      this.process.stderr?.on('data', (data) => {
        gatewayLog.error(data.toString().trimEnd())
      })

      this.process.on('error', (error) => {
        gatewayLog.error('[gateway.error]', error.message, `durationMs=${Date.now() - t0}`)
        this.setStatus('error')
      })

      this.process.on('exit', (code, signal) => {
        gatewayLog.info('[gateway.exit]', `code=${code}`, `signal=${signal}`)
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
      gatewayLog.error('[gateway.start.failed]', error, `durationMs=${Date.now() - t0}`)
      this.setStatus('error')
      throw error
    }
  }

  async stop(): Promise<void> {
    // If we didn't start it, try stopping the gateway service (best-effort) so UI controls still work.
    if (!this.process) {
      try {
        await execInLoginShell('openclaw gateway stop', { timeoutMs: 30_000 })
      } catch (error) {
        gatewayLog.warn('[gateway.stop.failed]', 'CLI stop failed:', error)
      }

      // Re-check reachability; don't lie to the UI.
      if (await this.isGatewayReachable()) {
        this.setStatus('running')
      } else {
        this.setStatus('stopped')
      }
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
    const prev = this.status
    this.status = status
    if (prev !== status) {
      gatewayLog.info('[gateway.status]', `${prev} -> ${status}`)
    }
    this.emit('status-changed', status)
  }
}
