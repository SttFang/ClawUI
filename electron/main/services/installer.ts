import { app, net } from 'electron'
import { createWriteStream, existsSync, mkdirSync, chmodSync } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { extract } from 'tar'

const execAsync = promisify(exec)

export interface InstallProgress {
  stage:
    | 'downloading-node'
    | 'extracting-node'
    | 'installing-openclaw'
    | 'verifying'
    | 'complete'
    | 'error'
  progress: number // 0-100
  message: string
  error?: string
}

export type ProgressCallback = (progress: InstallProgress) => void

export class InstallerService {
  private runtimeDir = path.join(app.getPath('userData'), 'runtime')
  private nodeVersion = '22.12.0'

  async install(onProgress: ProgressCallback): Promise<void> {
    try {
      // Ensure runtime directory exists
      if (!existsSync(this.runtimeDir)) {
        mkdirSync(this.runtimeDir, { recursive: true })
      }

      // Step 1: Download Node.js
      onProgress({
        stage: 'downloading-node',
        progress: 0,
        message: 'Downloading Node.js runtime...',
      })
      await this.downloadNode(onProgress)

      // Step 2: Extract Node.js
      onProgress({
        stage: 'extracting-node',
        progress: 40,
        message: 'Extracting Node.js...',
      })
      await this.extractNode()

      // Step 3: Install OpenClaw
      onProgress({
        stage: 'installing-openclaw',
        progress: 60,
        message: 'Installing OpenClaw...',
      })
      await this.installOpenClaw(onProgress)

      // Step 4: Verify installation
      onProgress({
        stage: 'verifying',
        progress: 90,
        message: 'Verifying installation...',
      })
      await this.verify()

      onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Installation complete!',
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      onProgress({
        stage: 'error',
        progress: 0,
        message: 'Installation failed',
        error: errorMessage,
      })
      throw error
    }
  }

  private getNodeDownloadUrl(): string {
    const platform = process.platform
    const arch = process.arch

    let platformStr: string
    let ext: string

    switch (platform) {
      case 'darwin':
        platformStr = 'darwin'
        ext = 'tar.gz'
        break
      case 'win32':
        platformStr = 'win'
        ext = 'zip'
        break
      case 'linux':
        platformStr = 'linux'
        ext = 'tar.gz'
        break
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    let archStr: string
    switch (arch) {
      case 'x64':
        archStr = 'x64'
        break
      case 'arm64':
        archStr = 'arm64'
        break
      default:
        throw new Error(`Unsupported architecture: ${arch}`)
    }

    return `https://nodejs.org/dist/v${this.nodeVersion}/node-v${this.nodeVersion}-${platformStr}-${archStr}.${ext}`
  }

  private async downloadNode(onProgress: ProgressCallback): Promise<string> {
    const url = this.getNodeDownloadUrl()
    const downloadPath = path.join(this.runtimeDir, 'node-download.tar.gz')

    return new Promise((resolve, reject) => {
      const request = net.request(url)

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`Failed to download Node.js: ${response.statusCode}`)
          )
          return
        }

        const totalSize =
          parseInt(response.headers['content-length'] as string, 10) || 0
        let downloadedSize = 0

        const fileStream = createWriteStream(downloadPath)

        response.on('data', (chunk: Buffer) => {
          fileStream.write(chunk)
          downloadedSize += chunk.length
          if (totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 40)
            onProgress({
              stage: 'downloading-node',
              progress,
              message: `Downloading Node.js... ${Math.round((downloadedSize / totalSize) * 100)}%`,
            })
          }
        })

        response.on('end', () => {
          fileStream.end()
          resolve(downloadPath)
        })

        response.on('error', reject)
      })

      request.on('error', reject)
      request.end()
    })
  }

  private async extractNode(): Promise<void> {
    const downloadPath = path.join(this.runtimeDir, 'node-download.tar.gz')
    const nodeDir = path.join(this.runtimeDir, 'node')

    // Remove existing node directory
    if (existsSync(nodeDir)) {
      await rm(nodeDir, { recursive: true })
    }
    await mkdir(nodeDir, { recursive: true })

    if (process.platform === 'win32') {
      // Use PowerShell for Windows
      await execAsync(
        `powershell -Command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${nodeDir}' -Force"`
      )
    } else {
      // Use tar for macOS/Linux
      await extract({
        file: downloadPath,
        cwd: nodeDir,
        strip: 1, // Remove the top-level directory
      })
    }

    // Make node executable
    if (process.platform !== 'win32') {
      const nodeBin = path.join(nodeDir, 'bin', 'node')
      if (existsSync(nodeBin)) {
        chmodSync(nodeBin, 0o755)
      }
    }

    // Cleanup download
    await rm(downloadPath, { force: true })
  }

  private async installOpenClaw(onProgress: ProgressCallback): Promise<void> {
    const nodeDir = path.join(this.runtimeDir, 'node')
    const npmPath =
      process.platform === 'win32'
        ? path.join(nodeDir, 'npm.cmd')
        : path.join(nodeDir, 'bin', 'npm')

    // Install openclaw package
    const installCmd = `"${npmPath}" install openclaw --prefix "${this.runtimeDir}"`

    await execAsync(installCmd, {
      env: {
        ...process.env,
        PATH:
          process.platform === 'win32'
            ? nodeDir
            : `${path.join(nodeDir, 'bin')}:${process.env.PATH}`,
      },
    })

    onProgress({
      stage: 'installing-openclaw',
      progress: 80,
      message: 'OpenClaw installed successfully',
    })
  }

  private async verify(): Promise<void> {
    const nodeDir = path.join(this.runtimeDir, 'node')
    const nodePath =
      process.platform === 'win32'
        ? path.join(nodeDir, 'node.exe')
        : path.join(nodeDir, 'bin', 'node')

    if (!existsSync(nodePath)) {
      throw new Error('Node.js installation verification failed')
    }

    const openclawPath = path.join(this.runtimeDir, 'node_modules', 'openclaw')
    if (!existsSync(openclawPath)) {
      throw new Error('OpenClaw installation verification failed')
    }
  }

  async uninstall(): Promise<void> {
    if (existsSync(this.runtimeDir)) {
      await rm(this.runtimeDir, { recursive: true })
    }
  }
}

export const installer = new InstallerService()
