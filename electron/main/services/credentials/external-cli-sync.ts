import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AuthProfileAdapter, AuthProfileCredential } from "./auth-profile-adapter";
import { configLog } from "../../lib/logger";

interface ExternalCliDef {
  profileId: string;
  provider: string;
  credPath: string;
  parse: (raw: string) => AuthProfileCredential | null;
}

function parseClaudeCli(raw: string): AuthProfileCredential | null {
  try {
    const data = JSON.parse(raw) as {
      oauth_token?: string;
      expiry?: string;
    };
    if (!data.oauth_token) return null;
    const expires = data.expiry ? new Date(data.expiry).getTime() : Date.now() + 3600_000;
    return {
      type: "oauth",
      provider: "anthropic",
      access: data.oauth_token,
      refresh: "",
      expires,
    };
  } catch {
    return null;
  }
}

function parseOAuthCredsJson(raw: string, provider: string): AuthProfileCredential | null {
  try {
    const data = JSON.parse(raw) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      email?: string;
    };
    if (!data.access_token) return null;
    return {
      type: "oauth",
      provider,
      access: data.access_token,
      refresh: data.refresh_token ?? "",
      expires: data.expires_at ?? Date.now() + 3600_000,
      email: data.email,
    };
  } catch {
    return null;
  }
}

const EXTERNAL_CLI_DEFS: ExternalCliDef[] = [
  {
    profileId: "anthropic-cli:default",
    provider: "anthropic",
    credPath: join(homedir(), ".claude", ".credentials.json"),
    parse: parseClaudeCli,
  },
  {
    profileId: "qwen-portal-cli:default",
    provider: "qwen-portal",
    credPath: join(homedir(), ".qwen", "oauth_creds.json"),
    parse: (raw) => parseOAuthCredsJson(raw, "qwen-portal"),
  },
  {
    profileId: "minimax-portal-cli:default",
    provider: "minimax-portal",
    credPath: join(homedir(), ".minimax", "oauth_creds.json"),
    parse: (raw) => parseOAuthCredsJson(raw, "minimax-portal"),
  },
];

/**
 * Sync external CLI credentials into auth-profiles on startup.
 * Only overwrites if the external credential has a newer expiry.
 */
export async function syncExternalCliCredentials(authProfiles: AuthProfileAdapter): Promise<void> {
  for (const def of EXTERNAL_CLI_DEFS) {
    if (!existsSync(def.credPath)) continue;

    try {
      const raw = await readFile(def.credPath, "utf-8");
      const cred = def.parse(raw);
      if (!cred) continue;

      const existing = await authProfiles.getProfile(def.profileId);
      if (existing && existing.type === "oauth" && "expires" in cred) {
        // Only overwrite if external credential expires later
        if (existing.expires >= (cred as { expires: number }).expires) continue;
      }

      await authProfiles.setProfile(def.profileId, cred);
      configLog.info("[credential.cli-sync]", `profileId=${def.profileId} source=${def.credPath}`);
    } catch (error) {
      configLog.debug(
        "[credential.cli-sync.skipped]",
        `profileId=${def.profileId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
