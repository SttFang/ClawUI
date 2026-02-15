import discordIcon from "@iconify/icons-logos/discord-icon";
import signal from "@iconify/icons-logos/signal";
import slackIcon from "@iconify/icons-logos/slack-icon";
import telegram from "@iconify/icons-logos/telegram";
import whatsappIcon from "@iconify/icons-logos/whatsapp-icon";
import type { BrandIcon } from "@/lib/iconifyBrandIcon";
import type { ChannelType } from "@/store/channels";
import { createIconifyBrandIcon } from "@/lib/iconifyBrandIcon";

const CHANNEL_ICONS: Partial<Record<ChannelType, BrandIcon>> = {
  telegram: createIconifyBrandIcon(telegram),
  discord: createIconifyBrandIcon(discordIcon),
  whatsapp: createIconifyBrandIcon(whatsappIcon),
  slack: createIconifyBrandIcon(slackIcon),
  signal: createIconifyBrandIcon(signal),
};

export function getChannelBrandIcon(type: ChannelType): BrandIcon | null {
  return CHANNEL_ICONS[type] ?? null;
}
