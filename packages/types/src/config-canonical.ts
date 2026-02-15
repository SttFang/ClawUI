// Canonical OpenClaw config type (v2).
// Mirrors the actual openclaw.json schema. All fields optional since
// the file may be partial — ConfigService deep-merges with defaults.

export interface CanonicalGatewayAuth {
  mode?: "token" | "password" | "none";
  token?: string;
  password?: string;
}

export interface CanonicalGatewayConfig {
  mode?: "local" | "remote";
  port?: number;
  bind?: "loopback" | string;
  auth?: CanonicalGatewayAuth;
}

export interface CanonicalOpenClawConfig {
  meta?: Record<string, unknown>;
  gateway?: CanonicalGatewayConfig;
  discovery?: {
    mdns?: { mode?: "off" | "minimal" | "full" };
  };
  agents?: {
    defaults?: {
      workspace?: string;
      model?: {
        primary?: string;
        fallbacks?: string[];
      };
      sandbox?: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
  session?: {
    scope?: "per-sender" | "per-channel-peer" | "main";
    store?: string;
    reset?: {
      mode?: "idle" | "daily";
      idleMinutes?: number;
    };
  };
  channels?: Record<string, unknown>;
  tools?: {
    allow?: string[];
    deny?: string[];
    [key: string]: unknown;
  };
  env?: Record<string, string>;
  cron?: {
    enabled?: boolean;
    store?: string;
  };
  hooks?: {
    enabled?: boolean;
    token?: string;
    path?: string;
  };
  auth?: Record<string, unknown>;
  wizard?: Record<string, unknown>;
  skills?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
  messages?: Record<string, unknown>;
  commands?: Record<string, unknown>;
}
