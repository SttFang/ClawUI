import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'
import { app } from 'electron'

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
    const [nodeResult, openclawResult, configResult] = await Promise.all([
      this.detectNode(),
      this.detectOpenClaw(),
      this.detectConfig(),
    ])

    return {
      ...nodeResult,
      ...openclawResult,
      ...configResult,
      configPath: this.configPath,
    }
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

    // Check system Node.js
    try {
      const { stdout: versionOutput } = await execAsync('node --version')
      const { stdout: pathOutput } = await execAsync(
        process.platform === 'win32' ? 'where node' : 'which node'
      )
      const version = versionOutput.trim()
      const nodePath = pathOutput.trim().split('\n')[0]

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
    // Check embedded OpenClaw
    const embeddedPath = path.join(this.runtimeDir, 'node_modules', 'openclaw')
    if (existsSync(embeddedPath)) {
      try {
        const pkgPath = path.join(embeddedPath, 'package.json')
        const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
        return {
          openclawInstalled: true,
          openclawVersion: pkg.version,
          openclawPath: embeddedPath,
        }
      } catch {
        // Fall through
      }
    }

    // Check global OpenClaw
    try {
      const { stdout } = await execAsync('npx openclaw --version')
      const version = stdout.trim()
      return {
        openclawInstalled: true,
        openclawVersion: version,
        openclawPath: 'global',
      }
    } catch {
      return {
        openclawInstalled: false,
        openclawVersion: null,
        openclawPath: null,
      }
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
    return path.join(this.runtimeDir, 'node', nodeBinary)
  }
}

export const runtimeDetector = new RuntimeDetectorService()
