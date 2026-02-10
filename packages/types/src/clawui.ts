export type Theme = "light" | "dark" | "system";
export type LocalePreference = "system" | "zh-CN" | "en-US";

export interface ClawUISessionMetadata {
  title: string;
  summary: string;
  tags: string[];
  icon?: string;
  generatedAt: number;
  sourceUpdatedAt?: number;
  sourceHash?: string;
  userEdited?: boolean;
  generator?: { profileId: "main" | "configAgent"; model?: string };
  error?: string;
  nextRetryAt?: number;
}

export interface ClawUIStateV1 {
  schemaVersion: 1;
  ui: {
    theme: Theme;
    locale: LocalePreference;
    sidebarCollapsed: boolean;
  };
  app: {
    autoCheckUpdates: boolean;
  };
  subscription: {
    currentPlan: "free" | "pro" | "team";
  };
  scheduler: {
    tasks: unknown[];
  };
  openclaw: {
    profiles: {
      main: { port: number };
      configAgent: { port: number };
    };
    autoStart: {
      main: boolean;
      configAgent: boolean;
    };
  };
  sessions: {
    metadata: Record<string, ClawUISessionMetadata>;
  };
}

export type ClawUIState = ClawUIStateV1;
