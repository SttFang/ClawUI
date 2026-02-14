import type {
  ModelsAuthOrderResult,
  ModelsCatalogResult,
  ModelsFallbacksResult,
  ModelsStatus,
  ModelsStatusProbeOptions,
} from "@clawui/types";
import type { IpcMain } from "electron";
import { mainLog } from "../lib/logger";
import {
  assertProvider,
  resolveOpenClawPath,
  runOpenClaw,
  runOpenClawJson,
  trimArg,
} from "../utils/openclaw-cli";

type ModelsAuthLoginOptions = {
  provider?: string;
  method?: string;
  setDefault?: boolean;
};

type ModelsAuthOrderSetInput = {
  provider: string;
  profileIds: string[];
  agentId?: string;
};

type ModelsAuthOrderInput = {
  provider: string;
  agentId?: string;
};

function buildModelsStatusArgs(options?: ModelsStatusProbeOptions): string[] {
  const args = ["models", "status", "--json"];
  if (!options?.probe) return args;

  args.push("--probe");
  const provider = trimArg(options.probeProvider);
  if (provider) args.push("--probe-provider", provider);

  for (const profileId of options.probeProfile ?? []) {
    const id = trimArg(profileId);
    if (!id) continue;
    args.push("--probe-profile", id);
  }

  if (typeof options.probeTimeout === "number" && Number.isFinite(options.probeTimeout)) {
    args.push("--probe-timeout", String(Math.max(1, Math.floor(options.probeTimeout))));
  }
  if (typeof options.probeConcurrency === "number" && Number.isFinite(options.probeConcurrency)) {
    args.push("--probe-concurrency", String(Math.max(1, Math.floor(options.probeConcurrency))));
  }
  if (typeof options.probeMaxTokens === "number" && Number.isFinite(options.probeMaxTokens)) {
    args.push("--probe-max-tokens", String(Math.max(1, Math.floor(options.probeMaxTokens))));
  }

  return args;
}

function buildModelsAuthLoginArgs(options?: ModelsAuthLoginOptions): string[] {
  const args = ["models", "auth", "login"];
  const provider = trimArg(options?.provider);
  const method = trimArg(options?.method);
  if (provider) args.push("--provider", provider);
  if (method) args.push("--method", method);
  if (options?.setDefault) args.push("--set-default");
  return args;
}

function toProfileList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => trimArg(item)).filter((item): item is string => Boolean(item));
}

export function registerModelsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    "models:status",
    async (_event, options?: ModelsStatusProbeOptions): Promise<ModelsStatus | null> => {
      const openclawPath = await resolveOpenClawPath();
      const args = buildModelsStatusArgs(options);
      try {
        const result = await runOpenClawJson<ModelsStatus>(openclawPath, args, "models status");
        mainLog.info("[models.status] loaded", {
          defaultModel: result.defaultModel,
          providers: result.auth.providers.length,
          probe: Boolean(options?.probe),
        });
        return result;
      } catch (error) {
        mainLog.warn("[models.status] failed", error);
        return null;
      }
    },
  );

  ipcMain.handle("models:list", async (): Promise<ModelsCatalogResult> => {
    const openclawPath = await resolveOpenClawPath();
    return runOpenClawJson<ModelsCatalogResult>(
      openclawPath,
      ["models", "list", "--json"],
      "models list",
    );
  });

  ipcMain.handle("models:set-default", async (_event, model: string): Promise<void> => {
    const value = trimArg(model);
    if (!value) throw new Error("model is required");
    const openclawPath = await resolveOpenClawPath();
    await runOpenClaw(openclawPath, ["models", "set", value], 40_000);
  });

  ipcMain.handle("models:fallbacks-list", async (): Promise<ModelsFallbacksResult> => {
    const openclawPath = await resolveOpenClawPath();
    return runOpenClawJson<ModelsFallbacksResult>(
      openclawPath,
      ["models", "fallbacks", "list", "--json"],
      "models fallbacks list",
    );
  });

  ipcMain.handle("models:fallbacks-add", async (_event, model: string): Promise<void> => {
    const value = trimArg(model);
    if (!value) throw new Error("model is required");
    const openclawPath = await resolveOpenClawPath();
    await runOpenClaw(openclawPath, ["models", "fallbacks", "add", value], 40_000);
  });

  ipcMain.handle("models:fallbacks-remove", async (_event, model: string): Promise<void> => {
    const value = trimArg(model);
    if (!value) throw new Error("model is required");
    const openclawPath = await resolveOpenClawPath();
    await runOpenClaw(openclawPath, ["models", "fallbacks", "remove", value], 40_000);
  });

  ipcMain.handle("models:fallbacks-clear", async (): Promise<void> => {
    const openclawPath = await resolveOpenClawPath();
    await runOpenClaw(openclawPath, ["models", "fallbacks", "clear"], 40_000);
  });

  ipcMain.handle(
    "models:auth-order-get",
    async (_event, input: ModelsAuthOrderInput): Promise<ModelsAuthOrderResult> => {
      const provider = assertProvider(input?.provider);
      const args = ["models", "auth", "order", "get", "--provider", provider, "--json"];
      const agentId = trimArg(input?.agentId);
      if (agentId) args.push("--agent", agentId);

      const openclawPath = await resolveOpenClawPath();
      return runOpenClawJson<ModelsAuthOrderResult>(openclawPath, args, "models auth order get");
    },
  );

  ipcMain.handle(
    "models:auth-order-set",
    async (_event, input: ModelsAuthOrderSetInput): Promise<ModelsAuthOrderResult> => {
      const provider = assertProvider(input?.provider);
      const profileIds = toProfileList(input?.profileIds);
      if (profileIds.length === 0) {
        throw new Error("profileIds is required");
      }

      const args = ["models", "auth", "order", "set", "--provider", provider];
      const agentId = trimArg(input?.agentId);
      if (agentId) args.push("--agent", agentId);
      args.push(...profileIds);

      const openclawPath = await resolveOpenClawPath();
      await runOpenClaw(openclawPath, args, 40_000);
      return runOpenClawJson<ModelsAuthOrderResult>(
        openclawPath,
        ["models", "auth", "order", "get", "--provider", provider, "--json"],
        "models auth order get",
      );
    },
  );

  ipcMain.handle(
    "models:auth-order-clear",
    async (_event, input: ModelsAuthOrderInput): Promise<ModelsAuthOrderResult> => {
      const provider = assertProvider(input?.provider);
      const args = ["models", "auth", "order", "clear", "--provider", provider];
      const agentId = trimArg(input?.agentId);
      if (agentId) args.push("--agent", agentId);

      const openclawPath = await resolveOpenClawPath();
      await runOpenClaw(openclawPath, args, 40_000);
      return runOpenClawJson<ModelsAuthOrderResult>(
        openclawPath,
        ["models", "auth", "order", "get", "--provider", provider, "--json"],
        "models auth order get",
      );
    },
  );

  ipcMain.handle(
    "models:auth-login",
    async (_event, options?: ModelsAuthLoginOptions): Promise<{ ok: true; stdout: string }> => {
      const openclawPath = await resolveOpenClawPath();
      const args = buildModelsAuthLoginArgs(options);
      const { stdout, stderr } = await runOpenClaw(openclawPath, args, 120_000);
      return {
        ok: true,
        stdout: [stdout.trim(), stderr.trim()].filter(Boolean).join("\n"),
      };
    },
  );
}
