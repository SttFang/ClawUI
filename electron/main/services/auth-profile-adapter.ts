import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { configLog } from "../lib/logger";

const AUTH_STORE_VERSION = 1;
const AUTH_PROFILE_FILENAME = "auth-profiles.json";

type ApiKeyCredential = {
  type: "api_key";
  provider: string;
  key?: string;
  email?: string;
  metadata?: Record<string, string>;
};

type TokenCredential = {
  type: "token";
  provider: string;
  token: string;
  expires?: number;
  email?: string;
};

type OAuthCredential = {
  type: "oauth";
  provider: string;
  access: string;
  refresh: string;
  expires: number;
  clientId?: string;
  email?: string;
  projectId?: string;
  accountId?: string;
};

export type AuthProfileCredential = ApiKeyCredential | TokenCredential | OAuthCredential;

export type AuthProfileStore = {
  version: number;
  profiles: Record<string, AuthProfileCredential>;
  order?: Record<string, string[]>;
  lastGood?: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class AuthProfileAdapter {
  private readonly storePath: string;

  constructor(agentsDir: string) {
    this.storePath = join(agentsDir, "main", AUTH_PROFILE_FILENAME);
  }

  getStorePath(): string {
    return this.storePath;
  }

  async read(): Promise<AuthProfileStore> {
    if (!existsSync(this.storePath)) {
      return { version: AUTH_STORE_VERSION, profiles: {} };
    }
    try {
      const raw = await readFile(this.storePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || !isRecord(parsed.profiles)) {
        configLog.warn("[auth-profile.read.invalid]", this.storePath);
        return { version: AUTH_STORE_VERSION, profiles: {} };
      }
      return parsed as AuthProfileStore;
    } catch (error) {
      configLog.error(
        "[auth-profile.read.failed]",
        error instanceof Error ? error.message : String(error),
      );
      return { version: AUTH_STORE_VERSION, profiles: {} };
    }
  }

  async write(store: AuthProfileStore): Promise<void> {
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const content = JSON.stringify(store, null, 2).concat("\n");
    await writeFile(this.storePath, content, { encoding: "utf-8", mode: 0o600 });
  }

  async getProfile(profileId: string): Promise<AuthProfileCredential | null> {
    const store = await this.read();
    return store.profiles[profileId] ?? null;
  }

  async setProfile(profileId: string, credential: AuthProfileCredential): Promise<void> {
    const store = await this.read();
    store.profiles[profileId] = credential;
    store.version = AUTH_STORE_VERSION;
    await this.write(store);
    configLog.info("[auth-profile.set]", `profileId=${profileId} provider=${credential.provider}`);
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    const store = await this.read();
    if (!(profileId in store.profiles)) return false;
    delete store.profiles[profileId];
    await this.write(store);
    configLog.info("[auth-profile.delete]", `profileId=${profileId}`);
    return true;
  }

  async hasKey(provider: string): Promise<boolean> {
    const store = await this.read();
    const profileId = `${provider}:default`;
    const profile = store.profiles[profileId];
    if (!profile) return false;
    if (profile.type === "api_key") return Boolean(profile.key);
    if (profile.type === "token") return Boolean(profile.token);
    if (profile.type === "oauth") return Boolean(profile.access);
    return false;
  }
}
