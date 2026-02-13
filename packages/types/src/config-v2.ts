// ============================================
// Config V2 Contracts (Snapshot + Draft Apply)
// ============================================

export type ConfigErrorCode =
  | "CONFIG_BASE_HASH_REQUIRED"
  | "CONFIG_BASE_HASH_CONFLICT"
  | "CONFIG_INVALID_RAW"
  | "CONFIG_INVALID_SCHEMA"
  | "CONFIG_WRITE_FAILED"
  | "CONFIG_GATEWAY_UNAVAILABLE";

export interface ConfigIssue {
  path: string;
  message: string;
}

export interface ConfigSnapshotV2 {
  path: string;
  exists: boolean;
  raw: string;
  hash: string | null;
  valid: boolean | null;
  issues: ConfigIssue[];
  config: Record<string, unknown>;
}

export interface ConfigUiHintV2 {
  label?: string;
  help?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
}

export interface ConfigSchemaV2 {
  schema: unknown;
  uiHints: Record<string, ConfigUiHintV2>;
  version: string;
  generatedAt: string;
}

export interface ConfigSetDraftInputV2 {
  raw: string;
  baseHash: string;
}

export interface ConfigSetDraftSuccessV2 {
  ok: true;
  hash: string | null;
  warnings: string[];
}

export interface ConfigSetDraftFailureV2 {
  ok: false;
  error: {
    code: ConfigErrorCode;
    message: string;
  };
}

export type ConfigSetDraftResponseV2 = ConfigSetDraftSuccessV2 | ConfigSetDraftFailureV2;
