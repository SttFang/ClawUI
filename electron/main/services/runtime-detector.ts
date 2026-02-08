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
    console.log('[RuntimeDetector] Starting detection...')
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
    console.log('[RuntimeDetector] Detection complete:', JSON.stringify(result, null, 2))
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
    // Check embedded OpenClaw first
    const embeddedPath = path.join(this.runtimeDir, 'node_modules', 'openclaw')
    if (existsSync(embeddedPath)) {
      try {
        const pkgPath = path.join(embeddedPath, 'package.json')
        const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
        console.log('[RuntimeDetector] Found embedded OpenClaw:', pkg.version)
        return {
          openclawInstalled: true,
          openclawVersion: pkg.version,
          openclawPath: embeddedPath,
        }
      } catch (error) {
        console.log('[RuntimeDetector] Failed to read embedded OpenClaw:', error)
        // Fall through
      }
    }

    // Check global OpenClaw via `which openclaw` or `where openclaw`
    // This is more reliable than npx which might try to download
    try {
      const whichCmd = process.platform === 'win32' ? 'where openclaw' : 'which openclaw'
      const { stdout: pathOutput } = await execAsync(whichCmd, { timeout: 5000 })
      const openclawPath = pathOutput.trim().split('\n')[0]

      if (openclawPath && existsSync(openclawPath)) {
        // Try to get version
        try {
          const { stdout: versionOutput } = await execAsync('openclaw --version', { timeout: 5000 })
          const version = versionOutput.trim()
          console.log('[RuntimeDetector] Found global OpenClaw:', version, 'at', openclawPath)
          return {
            openclawInstalled: true,
            openclawVersion: version,
            openclawPath,
          }
        } catch {
          // Has openclaw binary but can't get version
          console.log('[RuntimeDetector] Found OpenClaw binary but failed to get version')
          return {
            openclawInstalled: true,
            openclawVersion: 'unknown',
            openclawPath,
          }
        }
      }
    } catch {
      // which/where failed - OpenClaw not in PATH
      console.log('[RuntimeDetector] OpenClaw not found in PATH')
    }

    console.log('[RuntimeDetector] OpenClaw not installed')
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
    return path.join(this.runtimeDir, 'node', nodeBinary)
  }
}

export const runtimeDetector = new RuntimeDetectorService()
