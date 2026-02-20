import { describe, expect, test } from "vitest";
import type { OpenClawConfig, SkillsListResult } from "@/lib/ipc";
import { buildAgentsExportPayload } from "../export";

describe("buildAgentsExportPayload", () => {
  test("includes operations and attachments", () => {
    const skills = {
      skills: [
        { name: "a", description: "desc-a", source: "openclaw" },
        { name: "b", description: "desc-b", source: "agents" },
        { name: "c", description: "desc-c", source: "claude" },
      ],
    } satisfies SkillsListResult;

    const cfg = {
      _meta: { path: "/Users/me/.openclaw/openclaw.json" },
    } as unknown as OpenClawConfig;

    const payload = buildAgentsExportPayload({
      exportedAt: "2026-02-10T00:00:00.000Z",
      agent: {
        id: "main",
        modelPrimary: "openai/gpt-4o-mini",
        modelFallbacks: [],
        workspace: "/tmp",
      },
      channels: {
        configured: 1,
        enabled: 1,
        items: [{ type: "discord", name: "Discord", configured: true, enabled: true }],
      },
      tools: {
        accessMode: "ask",
        sandboxEnabled: false,
        allowList: ["group:runtime"],
        denyList: [],
      },
      pluginsInstalled: [{ id: "p1", name: "Plugin1", version: "1.0.0" }],
      mcpServers: [{ id: "m1", name: "m1", command: "node", args: ["server.js"], enabled: true }],
      skills,
      cronStatus: { enabled: true, jobs: 1 },
      cronJobs: [{ id: "j1" }],
      config: cfg,
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.exportedAt).toBe("2026-02-10T00:00:00.000Z");
    expect(payload.skills?.skills).toHaveLength(3);
    expect(payload.cron.status).toEqual({ enabled: true, jobs: 1 });
    expect(payload.operations.some((op) => op.kind === "rpc" && op.method === "cron.list")).toBe(
      true,
    );
    expect(
      payload.operations.some(
        (op) => op.kind === "navigate" && op.href === "#/settings?tab=capabilities&section=plugins",
      ),
    ).toBe(true);
    expect(payload.notes.openclawConfigPath).toBe("/Users/me/.openclaw/openclaw.json");
  });
});
