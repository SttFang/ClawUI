import { describe, expect, it } from "vitest";
import { defaultChannels } from "../defaultChannels";
import { buildActualChannelPatch, mapSnapshotToChannels } from "../helpers";

describe("channels helpers", () => {
  it("should persist discord appToken in patch payload", () => {
    const patch = buildActualChannelPatch("discord", {
      enabled: true,
      botToken: "discord-bot-token",
      appToken: "discord-app-id",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      requireMention: true,
    });

    expect(patch).toMatchObject({
      enabled: true,
      token: "discord-bot-token",
      appToken: "discord-app-id",
      dm: { policy: "pairing" },
      groupPolicy: "allowlist",
      guilds: { "*": { requireMention: true } },
    });
  });

  it("should read discord appToken from config snapshot", () => {
    const mapped = mapSnapshotToChannels(defaultChannels, {
      channels: {
        discord: {
          enabled: true,
          token: "discord-bot-token",
          appToken: "discord-app-id",
          dm: { policy: "pairing" },
          groupPolicy: "allowlist",
        },
      },
    });

    const discord = mapped.find((channel) => channel.type === "discord");
    expect(discord?.isConfigured).toBe(true);
    expect(discord?.config?.botToken).toBe("discord-bot-token");
    expect(discord?.config?.appToken).toBe("discord-app-id");
  });
});
