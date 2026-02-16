import { describe, expect, it } from "vitest";
import { defaultChannels } from "../defaultChannels";
import { buildActualChannelPatch, mapSnapshotToChannels } from "../helpers";

describe("channels helpers", () => {
  it("should build discord patch without appToken", () => {
    const patch = buildActualChannelPatch("discord", {
      enabled: true,
      botToken: "discord-bot-token",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      requireMention: true,
    });

    expect(patch).toMatchObject({
      enabled: true,
      token: "discord-bot-token",
      dm: { policy: "pairing" },
      groupPolicy: "allowlist",
      guilds: { "*": { requireMention: true } },
    });
    expect(patch).not.toHaveProperty("appToken");
  });

  it("should read discord config from snapshot", () => {
    const mapped = mapSnapshotToChannels(defaultChannels, {
      channels: {
        discord: {
          enabled: true,
          token: "discord-bot-token",
          dm: { policy: "pairing" },
          groupPolicy: "allowlist",
        },
      },
    });

    const discord = mapped.find((channel) => channel.type === "discord");
    expect(discord?.isConfigured).toBe(true);
    expect(discord?.config?.botToken).toBe("discord-bot-token");
  });

  it("should read discord dmPolicy/allowFrom from top-level aliases", () => {
    const mapped = mapSnapshotToChannels(defaultChannels, {
      channels: {
        discord: {
          enabled: true,
          token: "tok",
          dmPolicy: "open",
          allowFrom: ["*"],
          groupPolicy: "open",
        },
      },
    });

    const discord = mapped.find((channel) => channel.type === "discord");
    expect(discord?.config?.dmPolicy).toBe("open");
    expect(discord?.config?.allowFrom).toEqual(["*"]);
  });

  it("should prefer dm object over top-level aliases for discord", () => {
    const mapped = mapSnapshotToChannels(defaultChannels, {
      channels: {
        discord: {
          enabled: true,
          token: "tok",
          dmPolicy: "open",
          allowFrom: ["*"],
          dm: { policy: "pairing", allowFrom: ["user1"] },
        },
      },
    });

    const discord = mapped.find((channel) => channel.type === "discord");
    expect(discord?.config?.dmPolicy).toBe("pairing");
    expect(discord?.config?.allowFrom).toEqual(["user1"]);
  });
});
