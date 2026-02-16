import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import lockfile from "proper-lockfile";
import { configLog } from "../../lib/logger";
import { isRecord } from "../../utils/type-guards";

const AUTH_STORE_VERSION = 1;
const AUTH_PROFILE_FILENAME = "auth-profiles.json";

const LOCK_OPTIONS: lockfile.LockOptions = {
  retries: { retries: 10, factor: 2, minTimeout: 100, maxTimeout: 10_000, randomize: true },
  stale: 30_000,
};

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

const EMPTY_STORE: AuthProfileStore = { version: AUTH_STORE_VERSION, profiles: {} };

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
      return { ...EMPTY_STORE, profiles: {} };
    }
    try {
      const raw = await readFile(this.storePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || !isRecord(parsed.profiles)) {
        configLog.warn("[auth-profile.read.invalid]", this.storePath);
        return { ...EMPTY_STORE, profiles: {} };
      }
      return parsed as AuthProfileStore;
    } catch (error) {
      configLog.error(
        "[auth-profile.read.failed]",
        error instanceof Error ? error.message : String(error),
      );
      return { ...EMPTY_STORE, profiles: {} };
    }
  }

  async write(store: AuthProfileStore): Promise<void> {
    await this.ensureFile();
    const content = JSON.stringify(store, null, 2).concat("\n");
    await writeFile(this.storePath, content, { encoding: "utf-8", mode: 0o600 });
  }

  async getProfile(profileId: string): Promise<AuthProfileCredential | null> {
    const store = await this.read();
    return store.profiles[profileId] ?? null;
  }

  async setProfile(profileId: string, credential: AuthProfileCredential): Promise<void> {
    await this.updateWithLock((store) => {
      store.profiles[profileId] = credential;
      return true;
    });
    configLog.info("[auth-profile.set]", `profileId=${profileId} provider=${credential.provider}`);
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    let deleted = false;
    await this.updateWithLock((store) => {
      if (!(profileId in store.profiles)) return false;
      delete store.profiles[profileId];
      deleted = true;
      return true;
    });
    if (deleted) {
      configLog.info("[auth-profile.delete]", `profileId=${profileId}`);
    }
    return deleted;
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

  /**
   * Atomically read-modify-write the store under a file lock.
   * The updater receives the current store and should return `true` to write changes.
   */
  async updateWithLock(updater: (store: AuthProfileStore) => boolean): Promise<AuthProfileStore> {
    await this.ensureFile();
    const release = await lockfile.lock(this.storePath, LOCK_OPTIONS);
    try {
      const store = await this.read();
      const shouldWrite = updater(store);
      if (shouldWrite) {
        store.version = AUTH_STORE_VERSION;
        const content = JSON.stringify(store, null, 2).concat("\n");
        await writeFile(this.storePath, content, { encoding: "utf-8", mode: 0o600 });
      }
      return store;
    } finally {
      await release();
    }
  }

  /** Ensure the store file exists so lockfile can acquire a lock on it. */
  private async ensureFile(): Promise<void> {
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    if (!existsSync(this.storePath)) {
      const content = JSON.stringify(EMPTY_STORE, null, 2).concat("\n");
      await writeFile(this.storePath, content, { encoding: "utf-8", mode: 0o600 });
    }
  }
}
