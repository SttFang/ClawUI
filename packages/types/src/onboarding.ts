// ============================================
// Onboarding Types
// ============================================

/**
 * A single OpenClaw installation found on the system.
 */
export interface OpenClawInstall {
  path: string;
  version: string;
}

/**
 * Runtime detection result
 */
export interface RuntimeStatus {
  /** Whether Node.js >= 22 is installed */
  nodeInstalled: boolean;
  /** Node.js version string (e.g., "v22.12.0") */
  nodeVersion: string | null;
  /** Path to Node.js binary */
  nodePath: string | null;
  /** Whether OpenClaw is installed */
  openclawInstalled: boolean;
  /** OpenClaw version string (best/chosen version) */
  openclawVersion: string | null;
  /** Path to OpenClaw binary (best/chosen) */
  openclawPath: string | null;
  /** Whether config file exists */
  configExists: boolean;
  /** Whether config has valid API keys */
  configValid: boolean;
  /** Parsed config schema version for diagnostics */
  configSchemaVersion?: string | null;
  /** Path to config file (~/.openclaw/openclaw.json) */
  configPath: string;
  /** 已安装版本是否满足 ClawUI 最低要求 */
  openclawCompatible: boolean;
  /** 已安装但需要升级 */
  openclawNeedsUpgrade: boolean;
  /** 检测到的所有 OpenClaw 安装 */
  openclawInstalls: OpenClawInstall[];
  /** 是否存在多版本冲突（多个安装且版本不一致） */
  openclawConflict: boolean;
  /** ClawUI 要求的最低 OpenClaw 版本 */
  minRequiredVersion: string;
  /** npm registry 上的最新 OpenClaw 版本（检查失败时为 null） */
  openclawLatestVersion: string | null;
  /** 是否有可用更新（已安装版本 < 最新版本） */
  openclawUpdateAvailable: boolean;
}

/**
 * Installation progress stages
 */
export type InstallStage =
  | "idle"
  | "checking-requirements"
  | "installing-openclaw"
  | "verifying"
  | "complete"
  | "error";

/**
 * Installation progress update
 */
export interface InstallProgress {
  /** Current installation stage */
  stage: InstallStage;
  /** Progress percentage (0-100) */
  progress: number;
  /** Human-readable status message */
  message: string;
  /** Error message if stage is 'error' */
  error?: string;
}

/**
 * Onboarding step in the UI flow (simplified)
 * - checking: Initial detection
 * - install: Show install button
 * - installing: Installation in progress
 * - complete: Done, redirect to chat
 * - error: Installation failed
 */
export type OnboardingStep =
  | "checking" // Initial check
  | "install" // Show install button
  | "upgrade" // Installed but version too low
  | "installing" // Installation in progress
  | "complete" // Installation done, redirecting
  | "error"; // Installation failed

/**
 * BYOK (Bring Your Own Key) configuration
 */
export interface BYOKConfig {
  anthropic?: string;
  openai?: string;
}

/**
 * Subscription proxy configuration
 */
export interface SubscriptionConfig {
  proxyUrl: string;
  proxyToken: string;
}
