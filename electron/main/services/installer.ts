import type { OpenClawInstall } from "@clawui/types/onboarding";
import { spawn } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { installerLog } from "../lib/logger";
import { resolveCommandPath } from "../utils/login-shell";
import { scanAllOpenClawInstalls } from "../utils/openclaw-cli";
import { safeExecFile, enrichedEnv } from "../utils/safe-exec";
import { compareOpenClawVersions, MIN_OPENCLAW_VERSION } from "../utils/version";

export interface InstallProgress {
  stage: "checking-requirements" | "installing-openclaw" | "verifying" | "complete" | "error";
  progress: number; // 0-100
  message: string;
  error?: string;
}

export type ProgressCallback = (progress: InstallProgress) => void;

// Install latest — minimum version gate is handled by pre-check.
// Can be overridden via env `CLAWUI_OPENCLAW_SPEC`.
const DEFAULT_OPENCLAW_SPEC = "openclaw@latest";

export class InstallerService {
  async install(onProgress: ProgressCallback): Promise<void> {
    const t0 = Date.now();
    try {
      installerLog.info("[install.start]");

      onProgress({
        stage: "checking-requirements",
        progress: 0,
        message: "Checking Node.js/npm...",
      });
      await this.verifyNodeAndNpm();

      // Scan all openclaw installations
      const installs = await scanAllOpenClawInstalls();
      const best = this.pickBest(installs);

      if (best && compareOpenClawVersions(best.version, MIN_OPENCLAW_VERSION) >= 0) {
        // Already have a compatible version — clean up stale duplicates if any
        const stale = installs.filter((i) => i.path !== best.path);
        if (stale.length > 0) {
          installerLog.info(
            "[install.cleanup]",
            `keeping=${best.path} (${best.version})`,
            `removing=${stale.map((s) => `${s.path}(${s.version})`).join(", ")}`,
          );
          await this.removeStaleInstalls(stale);
        }

        installerLog.info(
          "[install.skip]",
          `version=${best.version}`,
          `path=${best.path}`,
          `minRequired=${MIN_OPENCLAW_VERSION}`,
        );
        onProgress({ stage: "complete", progress: 100, message: "OpenClaw already installed" });
        return;
      }

      // Need install or upgrade
      const action = best ? "Upgrading" : "Installing";
      onProgress({
        stage: "installing-openclaw",
        progress: 40,
        message: `${action} OpenClaw...`,
      });

      // If we have any existing install, upgrade at the best one's prefix.
      // Then clean up stale duplicates.
      const targetPrefix = best ? path.dirname(path.dirname(best.path)) : null;
      await this.installOpenClawGlobal(onProgress, targetPrefix);

      // Clean up other installs after upgrading
      if (installs.length > 1 && best) {
        const stale = installs.filter((i) => i.path !== best.path);
        await this.removeStaleInstalls(stale);
      }

      onProgress({ stage: "verifying", progress: 90, message: "Verifying installation..." });
      await this.verify();

      onProgress({ stage: "complete", progress: 100, message: "Installation complete!" });
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

  /** Pick the newest install. */
  private pickBest(installs: OpenClawInstall[]): OpenClawInstall | null {
    if (installs.length === 0) return null;
    return installs.reduce((a, b) => (compareOpenClawVersions(a.version, b.version) >= 0 ? a : b));
  }

  /**
   * Remove stale openclaw installs by uninstalling from their npm prefix.
   * Best-effort — failures are logged but don't block.
   */
  async removeStaleInstalls(stale: OpenClawInstall[]): Promise<void> {
    const npmPath = await resolveCommandPath("npm");
    if (!npmPath) return;

    for (const install of stale) {
      const prefix = path.dirname(path.dirname(install.path));
      try {
        installerLog.info("[install.cleanup.remove]", `path=${install.path}`, `prefix=${prefix}`);
        await safeExecFile(npmPath, ["uninstall", "-g", "openclaw", "--prefix", prefix], {
          timeoutMs: 60_000,
          env: enrichedEnv(),
        });
        installerLog.info("[install.cleanup.ok]", `prefix=${prefix}`);
      } catch (error) {
        installerLog.warn("[install.cleanup.failed]", `prefix=${prefix}`, String(error));
      }
    }
  }

  private async verifyNodeAndNpm(): Promise<void> {
    const t0 = Date.now();
    installerLog.info("[install.check.node]");
    const nodePath = await resolveCommandPath("node");
    if (!nodePath) throw new Error("onboarding.errors.nodeMissing");
    const { stdout: nodeVersionOutput } = await safeExecFile(nodePath, ["--version"], {
      timeoutMs: 10_000,
      env: enrichedEnv(),
    });
    const nodeVersion = nodeVersionOutput.trim();
    const major = parseInt(nodeVersion.replace(/^v/, "").split(".")[0] || "0", 10);
    if (!Number.isFinite(major) || major < 22) {
      throw new Error("onboarding.errors.nodeVersionTooLow");
    }

    const npmPath = await resolveCommandPath("npm");
    if (!npmPath) throw new Error("onboarding.errors.npmMissing");
    await safeExecFile(npmPath, ["--version"], { timeoutMs: 10_000, env: enrichedEnv() });
    installerLog.info(
      "[install.check.node.ok]",
      `version=${nodeVersion}`,
      `durationMs=${Date.now() - t0}`,
    );
  }

  /**
   * Install or upgrade OpenClaw globally.
   *
   * Environment unification:
   * - existingNpmPrefix set → upgrade at that prefix (respect user's environment)
   * - null → fresh install via default npm (ClawUI controls canonical path)
   */
  private async installOpenClawGlobal(
    onProgress: ProgressCallback,
    existingNpmPrefix: string | null,
  ): Promise<void> {
    const spec = process.env.CLAWUI_OPENCLAW_SPEC || DEFAULT_OPENCLAW_SPEC;
    if (!/^[a-zA-Z0-9@._/-]+$/.test(spec)) {
      throw new Error(`Invalid package spec: ${spec}`);
    }
    const t0 = Date.now();

    const npmPath = await resolveCommandPath("npm");
    if (!npmPath) throw new Error("npm not found in PATH");

    const args = ["--no-fund", "--no-audit", "install", "-g", spec];

    if (existingNpmPrefix) {
      args.push("--prefix", existingNpmPrefix);
      installerLog.info("[install.npm]", `spec=${spec}`, `prefix=${existingNpmPrefix}`);
      await this.cleanStaleTempDirs(path.join(existingNpmPrefix, "lib", "node_modules"));
    } else {
      installerLog.info("[install.npm]", `spec=${spec}`, "prefix=default");
    }

    await this.spawnNpmInstall(npmPath, args, onProgress);

    installerLog.info("[install.npm.ok]", `spec=${spec}`, `durationMs=${Date.now() - t0}`);
    onProgress({
      stage: "installing-openclaw",
      progress: 80,
      message: "OpenClaw installed successfully",
    });
  }

  /**
   * Remove stale `.openclaw-*` temp dirs left by failed npm upgrades (ENOTEMPTY fix).
   * Best-effort — failures are logged but don't block the install.
   */
  private async cleanStaleTempDirs(nodeModulesDir: string): Promise<void> {
    try {
      const entries = await readdir(nodeModulesDir);
      const stale = entries.filter((e) => e.startsWith(".openclaw-"));
      for (const dir of stale) {
        const full = path.join(nodeModulesDir, dir);
        installerLog.info("[install.cleanup.stale]", `path=${full}`);
        await rm(full, { recursive: true, force: true });
      }
    } catch {
      // Directory may not exist yet (fresh install) — that's fine.
    }
  }

  private spawnNpmInstall(
    npmPath: string,
    args: string[],
    onProgress: ProgressCallback,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(npmPath, args, {
        env: enrichedEnv(),
        timeout: 10 * 60_000,
      });

      let stdout = "";
      let stderr = "";
      let lineCount = 0;

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk;
        const newLines = String(chunk).split("\n").filter(Boolean).length;
        lineCount += newLines;
        const progress = Math.min(40 + lineCount * 2, 78);
        onProgress({
          stage: "installing-openclaw",
          progress,
          message: String(chunk).trim().slice(-80) || "Installing...",
        });
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`npm exited with code ${code}\n${stderr}`));
      });
    });
  }

  private async verify(): Promise<void> {
    const t0 = Date.now();
    installerLog.info("[install.verify]");
    const openclawPath = await resolveCommandPath("openclaw");
    if (!openclawPath)
      throw new Error("OpenClaw installation verification failed: openclaw not found in PATH");

    const { stdout } = await safeExecFile(openclawPath, ["--version"], {
      timeoutMs: 10_000,
      env: enrichedEnv(),
    });
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
    await safeExecFile(npmPath, ["uninstall", "-g", "openclaw"], {
      timeoutMs: 5 * 60_000,
      env: enrichedEnv(),
    });
    installerLog.info("[uninstall.complete]", `durationMs=${Date.now() - t0}`);
  }
}

export const installer = new InstallerService();
