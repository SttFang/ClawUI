import { app } from "electron";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEFAULT_GATEWAY_PORT } from "../constants";
import { mainLog } from "../lib/logger";
import { deepMerge } from "./config/config-utils";

export type Theme = "light" | "dark" | "system";
export type MotionPreference = "system" | "reduce" | "no-preference";

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
    locale: "system" | "zh-CN" | "en-US";
    sidebarCollapsed: boolean;
    motionPreference: MotionPreference;
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

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const DEFAULT_STATE: ClawUIState = {
  schemaVersion: 1,
  ui: {
    theme: "system",
    locale: "system",
    sidebarCollapsed: false,
    motionPreference: "system",
  },
  app: {
    autoCheckUpdates: true,
  },
  subscription: {
    currentPlan: "free",
  },
  scheduler: {
    tasks: [],
  },
  openclaw: {
    profiles: {
      main: { port: DEFAULT_GATEWAY_PORT },
      configAgent: { port: 19789 },
    },
    autoStart: {
      main: true,
      configAgent: true,
    },
  },
  sessions: {
    metadata: {},
  },
};

export class ClawUIStateService {
  private statePath: string | null = null;
  private state: ClawUIState | null = null;

  constructor() {
    // Path is resolved lazily in initialize() to avoid relying on app readiness.
  }

  getPath(): string {
    return this.statePath ?? join(app.getPath("userData"), "clawui.json");
  }

  async initialize(): Promise<void> {
    this.statePath = join(app.getPath("userData"), "clawui.json");
    const dir = dirname(this.statePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    if (!existsSync(this.statePath)) {
      this.state = DEFAULT_STATE;
      await this.save();
      return;
    }

    await this.load();
  }

  async get(): Promise<ClawUIState> {
    if (!this.state) await this.load();
    return this.state ?? DEFAULT_STATE;
  }

  async patch(partial: DeepPartial<ClawUIState>): Promise<ClawUIState> {
    const current = await this.get();
    this.state = deepMerge(current, partial as Partial<ClawUIState>);
    await this.save();
    return this.state;
  }

  async replace(next: Partial<ClawUIState>): Promise<ClawUIState> {
    // Import/restore flow: keep defaults for missing keys.
    this.state = deepMerge(DEFAULT_STATE, next);
    await this.save();
    return this.state;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.getPath(), "utf-8");
      const parsed = JSON.parse(raw) as Partial<ClawUIState>;
      // Keep it resilient: unknown keys are preserved by merge; missing keys are filled by default.
      this.state = deepMerge(DEFAULT_STATE, parsed);
    } catch (err) {
      mainLog.debug("[state.load.ignored]", err);
      this.state = DEFAULT_STATE;
      await this.save();
    }
  }

  private async save(): Promise<void> {
    const path = this.getPath();
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(this.state ?? DEFAULT_STATE, null, 2), "utf-8");
    await rename(tmp, path);
    try {
      await chmod(path, 0o600);
    } catch (err) {
      mainLog.debug("[state.chmod.ignored]", err);
    }
  }
}
