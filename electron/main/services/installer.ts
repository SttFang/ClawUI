import { installerLog } from "../lib/logger";
import { resolveCommandPath } from "../utils/login-shell";
import { safeExecFile } from "../utils/safe-exec";

export interface InstallProgress {
  stage: "checking-requirements" | "installing-openclaw" | "verifying" | "complete" | "error";
  progress: number; // 0-100
  message: string;
  error?: string;
}

export type ProgressCallback = (progress: InstallProgress) => void;

// Pin OpenClaw to a known-good version to avoid runtime/protocol drift.
// Can be overridden via env `CLAWUI_OPENCLAW_SPEC`.
const DEFAULT_OPENCLAW_SPEC = "openclaw@2026.2.9";

export class InstallerService {
  async install(onProgress: ProgressCallback): Promise<void> {
    const t0 = Date.now();
    try {
      installerLog.info("[install.start]");
      // Step 1: Check Node.js + npm
      onProgress({
        stage: "checking-requirements",
        progress: 0,
        message: "Checking Node.js/npm...",
      });
      await this.verifyNodeAndNpm();

      // Step 3: Install OpenClaw
      onProgress({
        stage: "installing-openclaw",
        progress: 40,
        message: `Installing OpenClaw globally (${DEFAULT_OPENCLAW_SPEC})...`,
      });
      await this.installOpenClawGlobal(onProgress);

      // Step 4: Verify installation
      onProgress({
        stage: "verifying",
        progress: 90,
        message: "Verifying installation...",
      });
      await this.verify();

      onProgress({
        stage: "complete",
        progress: 100,
        message: "Installation complete!",
      });
      installerLog.info("[install.complete]", `durationMs=${Date.now() - t0}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      installerLog.error("[install.failed]", errorMessage, `durationMs=${Date.now() - t0}`);
      onProgress({
        stage: "error",
        progress: 0,
        message: "Installation failed",
        error: errorMessage,
      });
      throw error;
    }
  }

  private async verifyNodeAndNpm(): Promise<void> {
    const t0 = Date.now();
    installerLog.info("[install.check.node]");
    // Require Node.js >= 22
    const nodePath = await resolveCommandPath("node");
    if (!nodePath) throw new Error("node not found in PATH");
    const { stdout: nodeVersionOutput } = await safeExecFile(nodePath, ["--version"], {
      timeoutMs: 10_000,
    });
    const nodeVersion = nodeVersionOutput.trim();
    const major = parseInt(nodeVersion.replace(/^v/, "").split(".")[0] || "0", 10);
    if (!Number.isFinite(major) || major < 22) {
      throw new Error(`Node.js v22+ required (found ${nodeVersion || "unknown"})`);
    }

    // Require npm
    const npmPath = await resolveCommandPath("npm");
    if (!npmPath) throw new Error("npm not found in PATH");
    await safeExecFile(npmPath, ["--version"], { timeoutMs: 10_000 });
    installerLog.info(
      "[install.check.node.ok]",
      `version=${nodeVersion}`,
      `durationMs=${Date.now() - t0}`,
    );
  }

  private async installOpenClawGlobal(onProgress: ProgressCallback): Promise<void> {
    const spec = process.env.CLAWUI_OPENCLAW_SPEC || DEFAULT_OPENCLAW_SPEC;
    if (!/^[a-zA-Z0-9@._/-]+$/.test(spec)) {
      throw new Error(`Invalid package spec: ${spec}`);
    }
    const t0 = Date.now();
    installerLog.info("[install.npm]", `spec=${spec}`);
    const npmPath = await resolveCommandPath("npm");
    if (!npmPath) throw new Error("npm not found in PATH");
    await safeExecFile(npmPath, ["--no-fund", "--no-audit", "install", "-g", spec], {
      timeoutMs: 10 * 60_000,
    });

    installerLog.info("[install.npm.ok]", `spec=${spec}`, `durationMs=${Date.now() - t0}`);
    onProgress({
      stage: "installing-openclaw",
      progress: 80,
      message: "OpenClaw installed successfully",
    });
  }

  private async verify(): Promise<void> {
    const t0 = Date.now();
    installerLog.info("[install.verify]");
    const openclawPath = await resolveCommandPath("openclaw");
    if (!openclawPath)
      throw new Error("OpenClaw installation verification failed: openclaw not found in PATH");

    const { stdout } = await safeExecFile(openclawPath, ["--version"], { timeoutMs: 10_000 });
    if (!stdout.trim())
      throw new Error("OpenClaw installation verification failed: could not read version");
    installerLog.info(
      "[install.verify.ok]",
      `version=${stdout.trim()}`,
      `path=${openclawPath}`,
      `durationMs=${Date.now() - t0}`,
    );
  }

  async uninstall(): Promise<void> {
    const t0 = Date.now();
    installerLog.info("[uninstall.start]");
    const npmPath = await resolveCommandPath("npm");
    if (!npmPath) throw new Error("npm not found in PATH");
    await safeExecFile(npmPath, ["uninstall", "-g", "openclaw"], { timeoutMs: 5 * 60_000 });
    installerLog.info("[uninstall.complete]", `durationMs=${Date.now() - t0}`);
  }
}

export const installer = new InstallerService();
