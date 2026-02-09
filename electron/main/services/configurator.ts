import { homedir } from 'os'
import path from 'path'
import { existsSync, mkdirSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { onboardingLog } from '../lib/logger'

export interface OpenClawConfig {
  models?: {
    anthropic?: {
      apiKey: string
      models?: string[]
    }
    openai?: {
      apiKey: string
      models?: string[]
    }
  }
  proxy?: {
    url: string
    token?: string
  }
  server?: {
    port: number
    host: string
  }
}

export interface BYOKConfig {
  anthropic?: string
  openai?: string
}

export interface SubscriptionConfig {
  proxyUrl: string
  proxyToken: string
}

export class ConfiguratorService {
  private configDir = path.join(homedir(), '.openclaw')
  private configPath = path.join(this.configDir, 'openclaw.json')

  async configureSubscription(config: SubscriptionConfig): Promise<void> {
    onboardingLog.info('Configuring subscription mode')
    const openclawConfig: OpenClawConfig = {
      proxy: {
        url: config.proxyUrl,
        token: config.proxyToken,
      },
      server: {
        port: 18789,
        host: '127.0.0.1',
      },
    }

    await this.writeConfig(openclawConfig)
  }

  async configureBYOK(keys: BYOKConfig): Promise<void> {
    onboardingLog.info('Configuring BYOK mode')
    const openclawConfig: OpenClawConfig = {
      models: {},
      server: {
        port: 18789,
        host: '127.0.0.1',
      },
    }

    if (keys.anthropic) {
      openclawConfig.models!.anthropic = {
        apiKey: keys.anthropic,
        models: [
          'claude-sonnet-4-5',
          'claude-opus-4',
          'claude-3-5-sonnet',
          'claude-3-haiku',
        ],
      }
    }

    if (keys.openai) {
      openclawConfig.models!.openai = {
        apiKey: keys.openai,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
      }
    }

    await this.writeConfig(openclawConfig)
  }

  async readConfig(): Promise<OpenClawConfig | null> {
    if (!existsSync(this.configPath)) {
      return null
    }

    try {
      const content = await readFile(this.configPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  async updateConfig(updates: Partial<OpenClawConfig>): Promise<void> {
    const currentConfig = (await this.readConfig()) || {}
    const newConfig = { ...currentConfig, ...updates }
    await this.writeConfig(newConfig)
  }

  private async writeConfig(config: OpenClawConfig): Promise<void> {
    // Ensure config directory exists
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true })
    }

    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
    onboardingLog.info('Config written to', this.configPath)
  }

  async validateApiKey(
    provider: 'anthropic' | 'openai',
    apiKey: string
  ): Promise<boolean> {
    // Basic format validation
    if (provider === 'anthropic') {
      return apiKey.startsWith('sk-ant-')
    }
    if (provider === 'openai') {
      return apiKey.startsWith('sk-')
    }
    return false
  }
}

export const configurator = new ConfiguratorService()
