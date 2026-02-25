import { app } from "electron";
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { detectorLog } from "../lib/logger";
import { execInLoginShell, resolveCommandPath } from "../utils/login-shell";
import { scanAllOpenClawInstalls } from "../utils/openclaw-cli";
import { compareOpenClawVersions, MIN_OPENCLAW_VERSION } from "../utils/version";
import { ConfigService, ConfigRepository } from "./config";

const execAsync = promisify(exec);

export interface OpenClawInstall {
  path: string;
  version: string;
}

export interface RuntimeStatus {
  nodeInstalled: boolean;
  nodeVersion: string | null;
  nodePath: string | null;
  openclawInstalled: boolean;
  openclawVersion: string | null;
  openclawPath: string | null;
  openclawCompatible: boolean;
  openclawNeedsUpgrade: boolean;
  openclawInstalls: OpenClawInstall[];
  openclawConflict: boolean;
  configExists: boolean;
  configValid: boolean;
  configSchemaVersion: string | null;
  configPath: string;
  minRequiredVersion: string;
  openclawLatestVersion: string | null;
  openclawUpdateAvailable: boolean;
}

export class RuntimeDetectorService {
  private runtimeDir = path.join(app.getPath("userData"), "runtime");
  private configRepository = new ConfigRepository(new ConfigService());
  private configPath = this.configRepository.getPath();

  async detect(): Promise<RuntimeStatus> {
    const t0 = Date.now();
    detectorLog.info("[detect.start]");
    const [nodeResult, openclawResult, configResult, latestVersion] = await Promise.all([
      this.detectNode(),
      this.detectOpenClaw(),
      this.detectConfig(),
      this.fetchLatestOpenClawVersion(),
    ]);

    const openclawUpdateAvailable =
      latestVersion && openclawResult.openclawVersion
        ? compareOpenClawVersions(openclawResult.openclawVersion, latestVersion) < 0
        : false;

    const result = {
      ...nodeResult,
      ...openclawResult,
      ...configResult,
      configPath: this.configPath,
      minRequiredVersion: MIN_OPENCLAW_VERSION,
      openclawLatestVersion: latestVersion,
      openclawUpdateAvailable,
    };
    detectorLog.info(
      "[detect.complete]",
      `node=${result.nodeVersion ?? "n/a"}`,
      `openclaw=${result.openclawVersion ?? "n/a"}`,
      `latest=${latestVersion ?? "n/a"}`,
      `updateAvailable=${openclawUpdateAvailable}`,
      `installs=${result.openclawInstalls.length}`,
      `conflict=${result.openclawConflict}`,
      `config=${result.configExists ? (result.configValid ? "valid" : "invalid") : "missing"}`,
      `durationMs=${Date.now() - t0}`,
    );
    return result;
  }

  private async detectNode(): Promise<{
    nodeInstalled: boolean;
    nodeVersion: string | null;
    nodePath: string | null;
  }> {
    // First check embedded Node.js
    const embeddedNodePath = this.getEmbeddedNodePath();
    if (embeddedNodePath && existsSync(embeddedNodePath)) {
      try {
        const { stdout } = await execAsync(`"${embeddedNodePath}" --version`);
        const version = stdout.trim();
        return {
          nodeInstalled: true,
          nodeVersion: version,
          nodePath: embeddedNodePath,
        };
      } catch (err) {
        detectorLog.debug("[detect.embedded.ignored]", err);
      }
    }

    // Check system Node.js (via login shell so PATH matches user's terminal)
    try {
      const t0 = Date.now();
      const { stdout: versionOutput } = await execInLoginShell("node --version", {
        timeoutMs: 5_000,
      });
      const nodePath = await resolveCommandPath("node");
      const version = versionOutput.trim();

      // Check if version >= 22
      const majorVersion = parseInt(version.replace("v", "").split(".")[0], 10);
      if (majorVersion >= 22) {
        detectorLog.info(
          "[detect.node]",
          `version=${version}`,
          `path=${nodePath}`,
          `durationMs=${Date.now() - t0}`,
        );
        return {
          nodeInstalled: true,
          nodeVersion: version,
          nodePath,
        };
      }
      detectorLog.warn(
        "[detect.node]",
        `version=${version} (<22, unsupported)`,
        `durationMs=${Date.now() - t0}`,
      );
      return {
        nodeInstalled: false,
        nodeVersion: version,
        nodePath: null,
      };
    } catch {
      detectorLog.warn("[detect.node]", "not found");
      return {
        nodeInstalled: false,
        nodeVersion: null,
        nodePath: null,
      };
    }
  }

  /**
   * Scan all openclaw installations in PATH, then pick the best (newest) one.
   */
  private async detectOpenClaw(): Promise<{
    openclawInstalled: boolean;
    openclawVersion: string | null;
    openclawPath: string | null;
    openclawCompatible: boolean;
    openclawNeedsUpgrade: boolean;
    openclawInstalls: OpenClawInstall[];
    openclawConflict: boolean;
  }> {
    const notInstalled = {
      openclawInstalled: false,
      openclawVersion: null,
      openclawPath: null,
      openclawCompatible: false,
      openclawNeedsUpgrade: false,
      openclawInstalls: [],
      openclawConflict: false,
    };

    try {
      const installs = await scanAllOpenClawInstalls();
      if (installs.length === 0) {
        detectorLog.info("[detect.openclaw]", "not installed");
        return notInstalled;
      }

      // Detect conflict: multiple installs with different versions
      const versions = new Set(installs.map((i) => i.version));
      const conflict = versions.size > 1;

      // Pick the best: newest version
      const best = installs.reduce((a, b) =>
        compareOpenClawVersions(a.version, b.version) >= 0 ? a : b,
      );

      const compatible = compareOpenClawVersions(best.version, MIN_OPENCLAW_VERSION) >= 0;

      if (conflict) {
        detectorLog.warn(
          "[detect.openclaw.conflict]",
          `found ${installs.length} installs with ${versions.size} distinct versions`,
          ...installs.map((i) => `${i.path}=${i.version}`),
          `chosen=${best.path} (${best.version})`,
        );
      } else {
        detectorLog.info(
          "[detect.openclaw]",
          `version=${best.version}`,
          `path=${best.path}`,
          `installs=${installs.length}`,
        );
      }

      return {
        openclawInstalled: true,
        openclawVersion: best.version,
        openclawPath: best.path,
        openclawCompatible: compatible,
        openclawNeedsUpgrade: !compatible,
        openclawInstalls: installs,
        openclawConflict: conflict,
      };
    } catch (error) {
      detectorLog.warn("[detect.openclaw]", "detection failed:", error);
      return notInstalled;
    }
  }

  private async fetchLatestOpenClawVersion(): Promise<string | null> {
    try {
      const { stdout } = await execInLoginShell("npm view openclaw version", { timeoutMs: 10_000 });
      return stdout.trim() || null;
    } catch {
      detectorLog.debug("[detect.openclaw.latest.failed]");
      return null;
    }
  }

  private async detectConfig(): Promise<{
    configExists: boolean;
    configValid: boolean;
    configSchemaVersion: string | null;
  }> {
    if (!existsSync(this.configPath)) {
      return { configExists: false, configValid: false, configSchemaVersion: null };
    }

    const inspected = await this.configRepository.inspectCanonicalConfig();
    return {
      configExists: inspected.exists,
      configValid: inspected.valid,
      configSchemaVersion: inspected.schemaVersion,
    };
  }

  private getEmbeddedNodePath(): string | null {
    const platform = process.platform;
    const nodeBinary = platform === "win32" ? "node.exe" : "node";
    if (platform === "win32") return path.join(this.runtimeDir, "node", nodeBinary);
    return path.join(this.runtimeDir, "node", "bin", nodeBinary);
  }
}

export const runtimeDetector = new RuntimeDetectorService();
