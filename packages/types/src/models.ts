/** Auth method for a provider */
export interface ProviderAuthEffective {
  kind: "env" | "profiles" | "token" | "none";
  detail?: string;
}

/** OAuth profile status */
export interface OAuthProfile {
  type: "oauth";
  status: "ok" | "expired" | "missing";
  // OpenClaw may return ms timestamp; keep it flexible for UI.
  expiresAt?: string | number;
}

/** Per-provider OAuth status */
export interface OAuthProviderStatus {
  provider: string;
  status: "ok" | "expired" | "missing";
  profiles: OAuthProfile[];
}

export interface OAuthStatusBlock {
  providers: OAuthProviderStatus[];
}

/** Per-provider auth info from CLI */
export interface ProviderAuthInfo {
  provider: string;
  effective: ProviderAuthEffective;
  profiles?: Record<string, number>;
}

/** Full output of `openclaw models status --json` */
export interface ModelsStatus {
  defaultModel: string;
  fallbacks: string[];
  auth: {
    providers: ProviderAuthInfo[];
    // Newer OpenClaw uses `auth.oauth`; older clients expected `auth.oauthStatus`.
    oauth?: OAuthStatusBlock;
    oauthStatus?: OAuthStatusBlock;
  };
}
