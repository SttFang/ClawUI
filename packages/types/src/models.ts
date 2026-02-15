/** Auth method for a provider */
export interface ProviderAuthEffective {
  kind: "env" | "profiles" | "token" | "models.json" | "missing" | "none";
  detail?: string;
}

/** OAuth profile status */
export interface OAuthProfile {
  profileId?: string;
  provider?: string;
  type: "oauth";
  status: "ok" | "expired" | "missing";
  // OpenClaw may return ms timestamp; keep it flexible for UI.
  expiresAt?: string | number;
  remainingMs?: number;
  source?: string;
  label?: string;
}

/** Per-provider OAuth status */
export interface OAuthProviderStatus {
  provider: string;
  status: "ok" | "expired" | "missing";
  profiles: OAuthProfile[];
  expiresAt?: string | number;
  remainingMs?: number;
}

export interface OAuthStatusBlock {
  warnAfterMs?: number;
  profiles?: OAuthProfile[];
  providers: OAuthProviderStatus[];
}

/** Per-provider auth info from CLI */
export interface ProviderAuthInfo {
  provider: string;
  effective: ProviderAuthEffective;
  profiles?: {
    count?: number;
    oauth?: number;
    token?: number;
    apiKey?: number;
    labels?: string[];
  };
  env?: {
    value?: string;
    source?: string;
  };
}

export interface ModelsStatusProbeOptions {
  probe?: boolean;
  probeProvider?: string;
  probeProfile?: string[];
  probeTimeout?: number;
  probeConcurrency?: number;
  probeMaxTokens?: number;
}

/** Full output of `openclaw models status --json` */
export interface ModelsStatus {
  configPath?: string;
  agentDir?: string;
  defaultModel: string;
  resolvedDefault?: string;
  fallbacks: string[];
  imageModel?: string | null;
  imageFallbacks?: string[];
  aliases?: Record<string, string>;
  allowed?: string[];
  auth: {
    storePath?: string;
    providersWithOAuth?: string[];
    missingProvidersInUse?: string[];
    providers: ProviderAuthInfo[];
    unusableProfiles?: unknown[];
    // Newer OpenClaw uses `auth.oauth`; older clients expected `auth.oauthStatus`.
    oauth?: OAuthStatusBlock;
    oauthStatus?: OAuthStatusBlock;
  };
}

export interface ModelCatalogEntry {
  id?: string;
  provider?: string;
  key: string;
  name: string;
  input?: string;
  contextWindow?: number;
  local?: boolean;
  available?: boolean;
  tags?: string[];
  missing?: boolean;
}

export interface ModelsCatalogResult {
  count: number;
  models: ModelCatalogEntry[];
}

export interface ModelsFallbacksResult {
  fallbacks: string[];
}

export interface ModelsAuthOrderResult {
  agentId: string;
  agentDir?: string;
  provider: string;
  authStorePath?: string;
  order: string[] | null;
}
