// ============================================
// Onboarding Types
// ============================================

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
  /** OpenClaw version string */
  openclawVersion: string | null;
  /** Path to OpenClaw installation */
  openclawPath: string | null;
  /** Whether config file exists */
  configExists: boolean;
  /** Whether config has valid API keys */
  configValid: boolean;
  /** Parsed config schema version for diagnostics */
  configSchemaVersion?: string | null;
  /** Path to config file (~/.openclaw/openclaw.json) */
  configPath: string;
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
