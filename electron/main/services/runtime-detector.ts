import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'
import { app } from 'electron'
import { execInLoginShell, resolveCommandPath } from '../utils/login-shell'
import { detectorLog } from '../lib/logger'

const execAsync = promisify(exec)

export interface RuntimeStatus {
  nodeInstalled: boolean
  nodeVersion: string | null
  nodePath: string | null
  openclawInstalled: boolean
  openclawVersion: string | null
  openclawPath: string | null
  configExists: boolean
  configValid: boolean
  configPath: string
}

export class RuntimeDetectorService {
  private runtimeDir = path.join(app.getPath('userData'), 'runtime')
  private configPath = path.join(homedir(), '.openclaw', 'openclaw.json')

  async detect(): Promise<RuntimeStatus> {
    detectorLog.info('Starting detection...')
    const [nodeResult, openclawResult, configResult] = await Promise.all([
      this.detectNode(),
      this.detectOpenClaw(),
      this.detectConfig(),
    ])

    const result = {
      ...nodeResult,
      ...openclawResult,
      ...configResult,
      configPath: this.configPath,
    }
    detectorLog.info(
      'Detection complete:',
      `node=${result.nodeVersion ?? 'n/a'}`,
      `openclaw=${result.openclawVersion ?? 'n/a'}`,
      `config=${result.configExists ? (result.configValid ? 'valid' : 'invalid') : 'missing'}`,
    )
    return result
  }

  private async detectNode(): Promise<{
    nodeInstalled: boolean
    nodeVersion: string | null
    nodePath: string | null
  }> {
    // First check embedded Node.js
    const embeddedNodePath = this.getEmbeddedNodePath()
    if (embeddedNodePath && existsSync(embeddedNodePath)) {
      try {
        const { stdout } = await execAsync(`"${embeddedNodePath}" --version`)
        const version = stdout.trim()
        return {
          nodeInstalled: true,
          nodeVersion: version,
          nodePath: embeddedNodePath,
        }
      } catch {
        // Fall through to system Node.js
      }
    }

    // Check system Node.js (via login shell so PATH matches user's terminal)
    try {
      const { stdout: versionOutput } = await execInLoginShell('node --version', {
        timeoutMs: 5_000,
      })
      const nodePath = await resolveCommandPath('node')
      const version = versionOutput.trim()

      // Check if version >= 22
      const majorVersion = parseInt(version.replace('v', '').split('.')[0], 10)
      if (majorVersion >= 22) {
        return {
          nodeInstalled: true,
          nodeVersion: version,
          nodePath,
        }
      }
      return {
        nodeInstalled: false,
        nodeVersion: version,
        nodePath: null,
      }
    } catch {
      return {
        nodeInstalled: false,
        nodeVersion: null,
        nodePath: null,
      }
    }
  }

  private async detectOpenClaw(): Promise<{
    openclawInstalled: boolean
    openclawVersion: string | null
    openclawPath: string | null
  }> {
    // For ClawUI's product goal, we treat "installed" as: available in the user's shell PATH.
    // (The embedded runtime install does not satisfy `openclaw` in Terminal.)
    try {
      const openclawPath = await resolveCommandPath('openclaw')
      if (openclawPath && existsSync(openclawPath)) {
        const { stdout: versionOutput } = await execInLoginShell(
          'openclaw --version',
          { timeoutMs: 5_000 }
        )
        const version = versionOutput.trim() || 'unknown'
        detectorLog.info('Found OpenClaw:', version, 'at', openclawPath)
        return {
          openclawInstalled: true,
          openclawVersion: version,
          openclawPath,
        }
      }
    } catch (error) {
      detectorLog.warn('Failed to detect OpenClaw:', error)
    }

    detectorLog.info('OpenClaw not installed')
    return {
      openclawInstalled: false,
      openclawVersion: null,
      openclawPath: null,
    }
  }

  private async detectConfig(): Promise<{
    configExists: boolean
    configValid: boolean
  }> {
    if (!existsSync(this.configPath)) {
      return { configExists: false, configValid: false }
    }

    try {
      const content = await readFile(this.configPath, 'utf-8')
      const config = JSON.parse(content)
      // Basic validation: check for required fields
      const isValid = Boolean(
        config.models &&
          (config.models.anthropic || config.models.openai || config.proxy)
      )
      return { configExists: true, configValid: isValid }
    } catch {
      return { configExists: true, configValid: false }
    }
  }

  private getEmbeddedNodePath(): string | null {
    const platform = process.platform
    const nodeBinary = platform === 'win32' ? 'node.exe' : 'node'
    if (platform === 'win32') return path.join(this.runtimeDir, 'node', nodeBinary)
    return path.join(this.runtimeDir, 'node', 'bin', nodeBinary)
  }
}

export const runtimeDetector = new RuntimeDetectorService()
