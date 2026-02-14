import { net } from "electron";
import { configLog } from "../lib/logger";
import { AuthProfileAdapter, type AuthProfileCredential } from "./auth-profile-adapter";

// GitHub Copilot OAuth — same client ID as OpenClaw
const GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";

export interface DeviceCodeInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface OAuthResult {
  credential: AuthProfileCredential;
  profileId: string;
}

async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
  const response = await net.fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export class OAuthService {
  constructor(private readonly authProfiles: AuthProfileAdapter) {}

  // --- GitHub Copilot: Device Code Flow ---

  async startDeviceCodeFlow(provider: string): Promise<DeviceCodeInfo> {
    if (provider !== "github-copilot") {
      throw new Error(`Device code flow not supported for provider: ${provider}`);
    }

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: "read:user",
    });

    const response = await net.fetch(GITHUB_DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    const data = (await response.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    };

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval,
    };
  }

  async pollDeviceCodeToken(
    provider: string,
    deviceCode: string,
    interval: number,
  ): Promise<OAuthResult> {
    if (provider !== "github-copilot") {
      throw new Error(`Device code flow not supported for provider: ${provider}`);
    }

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });

    // Poll until we get a token or timeout
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));

      const response = await net.fetch(GITHUB_ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      });

      const data = (await response.json()) as {
        access_token?: string;
        error?: string;
      };

      if (data.access_token) {
        // Exchange GitHub token for Copilot token
        const copilotToken = await this.exchangeCopilotToken(data.access_token);

        const credential: AuthProfileCredential = {
          type: "oauth",
          provider: "github-copilot",
          access: copilotToken.token,
          refresh: data.access_token, // GitHub token is the refresh source
          expires: copilotToken.expiresAt,
        };

        const profileId = "github-copilot:default";
        await this.authProfiles.setProfile(profileId, credential);
        configLog.info("[oauth.device-code.success]", `provider=${provider}`);

        return { credential, profileId };
      }

      if (data.error === "authorization_pending") continue;
      if (data.error === "slow_down") {
        interval += 5; // back off
        continue;
      }
      if (data.error) {
        throw new Error(`OAuth error: ${data.error}`);
      }
    }

    throw new Error("Device code flow timed out");
  }

  // --- Token refresh ---

  async refreshIfNeeded(profileId: string): Promise<boolean> {
    const profile = await this.authProfiles.getProfile(profileId);
    if (!profile || profile.type !== "oauth") return false;

    // Refresh 5 minutes before expiry
    const buffer = 5 * 60 * 1000;
    if (profile.expires > Date.now() + buffer) return false;

    try {
      const refreshed = await this.refreshToken(profile.provider, profile);
      await this.authProfiles.setProfile(profileId, refreshed);
      configLog.info("[oauth.refresh.success]", `profileId=${profileId}`);
      return true;
    } catch (error) {
      configLog.error(
        "[oauth.refresh.failed]",
        `profileId=${profileId}`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  // --- Internals ---

  private async exchangeCopilotToken(
    githubToken: string,
  ): Promise<{ token: string; expiresAt: number }> {
    const data = await fetchJson<{ token: string; expires_at: number }>(GITHUB_COPILOT_TOKEN_URL, {
      method: "GET",
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/json",
      },
    });

    return { token: data.token, expiresAt: data.expires_at * 1000 };
  }

  private async refreshToken(
    provider: string,
    cred: Extract<AuthProfileCredential, { type: "oauth" }>,
  ): Promise<AuthProfileCredential> {
    if (provider === "github-copilot") {
      // Re-exchange the GitHub token for a fresh Copilot token
      const copilotToken = await this.exchangeCopilotToken(cred.refresh);
      return { ...cred, access: copilotToken.token, expires: copilotToken.expiresAt };
    }
    throw new Error(`Token refresh not implemented for provider: ${provider}`);
  }
}
