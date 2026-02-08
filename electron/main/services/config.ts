import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import JSON5 from 'json5'

export interface OpenClawConfig {
  gateway: {
    port: number
    bind: string
    token: string
  }
  agents: {
    defaults: {
      workspace: string
      model: {
        primary: string
        fallbacks: string[]
      }
      sandbox: { enabled: boolean }
    }
  }
  session: {
    scope: 'per-sender' | 'per-channel-peer' | 'main'
    store: string
    reset: {
      mode: 'idle' | 'daily'
      idleMinutes: number
    }
  }
  channels: Record<string, unknown>
  tools: {
    access: 'auto' | 'ask' | 'deny'
    allow: string[]
    deny: string[]
    sandbox: { enabled: boolean }
  }
  providers: Record<string, { apiKey: string; baseUrl?: string }>
  env: Record<string, string>
  cron: {
    enabled: boolean
    store: string
  }
  hooks: {
    enabled: boolean
    token: string
    path: string
  }
}

const DEFAULT_CONFIG: OpenClawConfig = {
  gateway: {
    port: 18789,
    bind: '127.0.0.1',
    token: '',
  },
  agents: {
    defaults: {
      workspace: '~/.openclaw/workspace',
      model: {
        primary: 'anthropic/claude-sonnet-4-5-20250929',
        fallbacks: ['openai/gpt-4o'],
      },
      sandbox: { enabled: true },
    },
  },
  session: {
    scope: 'per-sender',
    store: '~/.openclaw/agents/{agentId}/sessions/sessions.json',
    reset: {
      mode: 'idle',
      idleMinutes: 60,
    },
  },
  channels: {},
  tools: {
    access: 'ask',
    allow: ['group:fs', 'web_*'],
    deny: ['exec'],
    sandbox: { enabled: true },
  },
  providers: {},
  env: {},
  cron: {
    enabled: true,
    store: '~/.openclaw/cron/jobs.json',
  },
  hooks: {
    enabled: true,
    token: 'webhook-secret',
    path: '/hooks',
  },
}

export class ConfigService {
  private configPath: string
  private config: OpenClawConfig | null = null

  constructor() {
    this.configPath = join(homedir(), '.openclaw', 'openclaw.json')
  }

  async initialize(): Promise<void> {
    // Ensure .openclaw directory exists
    const configDir = dirname(this.configPath)
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true })
    }

    // Load or create config
    if (existsSync(this.configPath)) {
      await this.loadConfig()
    } else {
      this.config = { ...DEFAULT_CONFIG }
      // Generate a random token if not set
      this.config.gateway.token = this.generateToken()
      await this.saveConfig()
    }
  }

  getConfigPath(): string {
    return this.configPath
  }

  async getConfig(): Promise<OpenClawConfig | null> {
    if (!this.config) {
      await this.loadConfig()
    }
    return this.config
  }

  async setConfig(partial: Partial<OpenClawConfig>): Promise<void> {
    if (!this.config) {
      await this.loadConfig()
    }

    // Deep merge the partial config
    this.config = this.deepMerge(this.config || DEFAULT_CONFIG, partial)
    await this.saveConfig()
  }

  private async loadConfig(): Promise<void> {
    try {
      const content = await readFile(this.configPath, 'utf-8')
      this.config = JSON5.parse(content) as OpenClawConfig
    } catch (error) {
      console.error('Failed to load config:', error)
      this.config = { ...DEFAULT_CONFIG }
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const content = JSON.stringify(this.config, null, 2)
      await writeFile(this.configPath, content, 'utf-8')
    } catch (error) {
      console.error('Failed to save config:', error)
      throw error
    }
  }

  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target } as T

    for (const key in source) {
      const sourceValue = source[key]
      const targetValue = (result as Record<string, unknown>)[key]

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = this.deepMerge(
          targetValue,
          sourceValue as Partial<typeof targetValue>
        )
      } else {
        (result as Record<string, unknown>)[key] = sourceValue
      }
    }

    return result
  }

  private generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
}
