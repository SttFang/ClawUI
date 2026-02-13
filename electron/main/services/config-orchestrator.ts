import type {
  ConfigErrorCode,
  ConfigSchemaV2,
  ConfigSetDraftInputV2,
  ConfigSetDraftResponseV2,
  ConfigSnapshotV2,
} from "@clawui/types/config-v2";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import JSON5 from "json5";
import type { ConfigService } from "./config";
import { configLog } from "../lib/logger";
import { ensureGatewayConnected } from "../utils/ensure-connected";
import { chatWebSocket } from "./chat-websocket";

type JsonObject = Record<string, unknown>;

type ConfigRpcSnapshot = {
  path?: unknown;
  exists?: unknown;
  raw?: unknown;
  hash?: unknown;
  valid?: unknown;
  issues?: unknown;
  config?: unknown;
};

type ConfigRpcSchema = {
  schema?: unknown;
  uiHints?: unknown;
  version?: unknown;
  generatedAt?: unknown;
};

const DEFAULT_SCHEMA_VERSION = "clawui-fallback-v1";

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asConfigObject(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function normalizeIssues(value: unknown): Array<{ path: string; message: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const path = typeof entry.path === "string" ? entry.path : "$";
      const message = typeof entry.message === "string" ? entry.message : "Invalid value";
      return { path, message };
    })
    .filter((entry): entry is { path: string; message: string } => Boolean(entry));
}

function hashRaw(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function buildFallbackSchema(): ConfigSchemaV2 {
  return {
    schema: null,
    uiHints: {},
    version: DEFAULT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

function toOrchestratorFailure(code: ConfigErrorCode, message: string): ConfigSetDraftResponseV2 {
  return {
    ok: false,
    error: { code, message },
  };
}

function mapGatewayErrorToCode(message: string): ConfigErrorCode {
  const normalized = message.toLowerCase();
  if (normalized.includes("base hash required") || normalized.includes("hash missing")) {
    return "CONFIG_BASE_HASH_REQUIRED";
  }
  if (normalized.includes("changed since last load") || normalized.includes("hash conflict")) {
    return "CONFIG_BASE_HASH_CONFLICT";
  }
  if (normalized.includes("invalid config")) {
    return "CONFIG_INVALID_SCHEMA";
  }
  if (normalized.includes("invalid config.set params") || normalized.includes("json")) {
    return "CONFIG_INVALID_RAW";
  }
  return "CONFIG_WRITE_FAILED";
}

export class ConfigOrchestrator {
  constructor(
    private readonly options: {
      configPath: string;
      configService: ConfigService;
    },
  ) {}

  async getSnapshot(): Promise<ConfigSnapshotV2> {
    const gatewaySnapshot = await this.tryGetSnapshotViaGateway();
    if (gatewaySnapshot) return gatewaySnapshot;
    return this.readLocalSnapshot();
  }

  async getSchema(): Promise<ConfigSchemaV2> {
    const gatewaySchema = await this.tryGetSchemaViaGateway();
    if (gatewaySchema) return gatewaySchema;
    return buildFallbackSchema();
  }

  async setDraft(input: ConfigSetDraftInputV2): Promise<ConfigSetDraftResponseV2> {
    const raw = typeof input.raw === "string" ? input.raw : "";
    if (!raw.trim()) {
      return toOrchestratorFailure("CONFIG_INVALID_RAW", "config raw must be a non-empty string");
    }

    const baseHash = typeof input.baseHash === "string" ? input.baseHash.trim() : "";
    return this.trySetDraftViaGateway({ raw, baseHash });
  }

  private async tryGetSnapshotViaGateway(): Promise<ConfigSnapshotV2 | null> {
    try {
      await ensureGatewayConnected(this.options.configService);
      const payload = (await chatWebSocket.request("config.get", {})) as ConfigRpcSnapshot;
      return this.normalizeGatewaySnapshot(payload);
    } catch (error) {
      configLog.debug(
        "[config.orchestrator.snapshot.gateway.unavailable]",
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  private async tryGetSchemaViaGateway(): Promise<ConfigSchemaV2 | null> {
    try {
      await ensureGatewayConnected(this.options.configService);
      const payload = (await chatWebSocket.request("config.schema", {})) as ConfigRpcSchema;
      return this.normalizeGatewaySchema(payload);
    } catch (error) {
      configLog.debug(
        "[config.orchestrator.schema.gateway.unavailable]",
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  private async trySetDraftViaGateway(
    input: ConfigSetDraftInputV2,
  ): Promise<ConfigSetDraftResponseV2> {
    try {
      await ensureGatewayConnected(this.options.configService);
      await chatWebSocket.request("config.set", {
        raw: input.raw,
        baseHash: input.baseHash,
      });
      const snapshot = await this.tryGetSnapshotViaGateway();
      return {
        ok: true,
        hash: snapshot?.hash ?? null,
        warnings: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Gateway is reachable but rejected request -> surface structured error.
      if (chatWebSocket.isConnected()) {
        return toOrchestratorFailure(mapGatewayErrorToCode(message), message);
      }
      configLog.warn("[config.orchestrator.set.gateway.unavailable]", message);
      return toOrchestratorFailure(
        "CONFIG_GATEWAY_UNAVAILABLE",
        "gateway unavailable; start or connect gateway and retry",
      );
    }
  }

  private normalizeGatewaySnapshot(payload: ConfigRpcSnapshot): ConfigSnapshotV2 {
    const configObject = asConfigObject(payload.config);
    const raw =
      typeof payload.raw === "string"
        ? payload.raw
        : JSON.stringify(configObject, null, 2).concat("\n");
    return {
      path: typeof payload.path === "string" ? payload.path : this.options.configPath,
      exists: typeof payload.exists === "boolean" ? payload.exists : true,
      raw,
      hash: typeof payload.hash === "string" && payload.hash.trim() ? payload.hash : hashRaw(raw),
      valid: typeof payload.valid === "boolean" ? payload.valid : null,
      issues: normalizeIssues(payload.issues),
      config: configObject,
    };
  }

  private normalizeGatewaySchema(payload: ConfigRpcSchema): ConfigSchemaV2 {
    return {
      schema: payload.schema ?? null,
      uiHints: isRecord(payload.uiHints) ? (payload.uiHints as ConfigSchemaV2["uiHints"]) : {},
      version:
        typeof payload.version === "string" && payload.version.trim()
          ? payload.version
          : DEFAULT_SCHEMA_VERSION,
      generatedAt:
        typeof payload.generatedAt === "string" && payload.generatedAt.trim()
          ? payload.generatedAt
          : new Date().toISOString(),
    };
  }

  private async readLocalSnapshot(): Promise<ConfigSnapshotV2> {
    if (!existsSync(this.options.configPath)) {
      return {
        path: this.options.configPath,
        exists: false,
        raw: "{\n}\n",
        hash: null,
        valid: true,
        issues: [],
        config: {},
      };
    }

    try {
      const raw = await readFile(this.options.configPath, "utf-8");
      const parsed = JSON5.parse(raw);
      if (!isRecord(parsed)) {
        return {
          path: this.options.configPath,
          exists: true,
          raw,
          hash: hashRaw(raw),
          valid: false,
          issues: [{ path: "$", message: "config root must be an object" }],
          config: {},
        };
      }

      return {
        path: this.options.configPath,
        exists: true,
        raw,
        hash: hashRaw(raw),
        valid: true,
        issues: [],
        config: parsed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      configLog.error("[config.orchestrator.snapshot.local.read.failed]", message);
      return {
        path: this.options.configPath,
        exists: true,
        raw: "",
        hash: null,
        valid: false,
        issues: [{ path: "$", message }],
        config: {},
      };
    }
  }
}
