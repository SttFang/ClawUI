import { execInLoginShell, resolveCommandPath } from '../utils/login-shell'
import { installerLog } from '../lib/logger'

export interface InstallProgress {
  stage:
    | 'checking-requirements'
    | 'installing-openclaw'
    | 'verifying'
    | 'complete'
    | 'error'
  progress: number // 0-100
  message: string
  error?: string
}

export type ProgressCallback = (progress: InstallProgress) => void

const DEFAULT_OPENCLAW_SPEC = 'openclaw@latest'

export class InstallerService {
  async install(onProgress: ProgressCallback): Promise<void> {
    try {
      installerLog.info('Starting installation...')
      // Step 1: Check Node.js + npm
      onProgress({
        stage: 'checking-requirements',
        progress: 0,
        message: 'Checking Node.js/npm...',
      })
      await this.verifyNodeAndNpm()

      // Step 3: Install OpenClaw
      onProgress({
        stage: 'installing-openclaw',
        progress: 40,
        message: `Installing OpenClaw globally (${DEFAULT_OPENCLAW_SPEC})...`,
      })
      await this.installOpenClawGlobal(onProgress)

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
      installerLog.error('Installation failed:', errorMessage)
      onProgress({
        stage: 'error',
        progress: 0,
        message: 'Installation failed',
        error: errorMessage,
      })
      throw error
    }
  }

  private async verifyNodeAndNpm(): Promise<void> {
    installerLog.info('Checking Node.js and npm...')
    // Require Node.js >= 22
    const { stdout: nodeVersionOutput } = await execInLoginShell('node --version', {
      timeoutMs: 10_000,
    })
    const nodeVersion = nodeVersionOutput.trim()
    const major = parseInt(nodeVersion.replace(/^v/, '').split('.')[0] || '0', 10)
    if (!Number.isFinite(major) || major < 22) {
      throw new Error(`Node.js v22+ required (found ${nodeVersion || 'unknown'})`)
    }

    // Require npm
    await execInLoginShell('npm --version', { timeoutMs: 10_000 })
  }

  private async installOpenClawGlobal(onProgress: ProgressCallback): Promise<void> {
    const spec = process.env.CLAWUI_OPENCLAW_SPEC || DEFAULT_OPENCLAW_SPEC
    installerLog.info('Installing globally:', spec)
    await execInLoginShell(
      // Keep it quiet-ish but still show errors
      `npm --no-fund --no-audit install -g ${spec}`,
      { timeoutMs: 10 * 60_000 }
    )

    onProgress({
      stage: 'installing-openclaw',
      progress: 80,
      message: 'OpenClaw installed successfully',
    })
  }

  private async verify(): Promise<void> {
    installerLog.info('Verifying installation...')
    const openclawPath = await resolveCommandPath('openclaw')
    if (!openclawPath) throw new Error('OpenClaw installation verification failed: openclaw not found in PATH')

    const { stdout } = await execInLoginShell('openclaw --version', { timeoutMs: 10_000 })
    if (!stdout.trim()) throw new Error('OpenClaw installation verification failed: could not read version')
  }

  async uninstall(): Promise<void> {
    installerLog.info('Uninstalling OpenClaw...')
    // Best-effort uninstall; this might fail on systems where global npm needs extra permissions.
    await execInLoginShell('npm uninstall -g openclaw', { timeoutMs: 5 * 60_000 })
  }
}

export const installer = new InstallerService()
