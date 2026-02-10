import type { ChannelType } from "@/store/channels";
import type { BrandIcon } from "@/lib/iconifyBrandIcon";
import { createIconifyBrandIcon } from "@/lib/iconifyBrandIcon";
import type { IconifyIcon } from "@iconify/react";
import discordIcon from "@iconify/icons-logos/discord-icon";
import signal from "@iconify/icons-logos/signal";
import slackIcon from "@iconify/icons-logos/slack-icon";
import telegram from "@iconify/icons-logos/telegram";
import whatsappIcon from "@iconify/icons-logos/whatsapp-icon";

// WeChat: original (non-Flaticon) two-bubble mark, matching the common visual language.
// We use an SVG mask to punch "eye" holes so it works on both light/dark backgrounds.
const weChatIcon: IconifyIcon = {
  width: 512,
  height: 512,
  body: [
    '<defs>',
    '<mask id="clawui-wechat-eyes">',
    '<rect width="512" height="512" fill="#fff"/>',
    '<circle cx="164" cy="214" r="22" fill="#000"/>',
    '<circle cx="268" cy="214" r="22" fill="#000"/>',
    '<circle cx="322" cy="332" r="20" fill="#000"/>',
    '<circle cx="416" cy="332" r="20" fill="#000"/>',
    "</mask>",
    "</defs>",
    '<g mask="url(#clawui-wechat-eyes)">',
    '<circle cx="218" cy="222" r="170" fill="#07C160"/>',
    '<path fill="#07C160" d="M122 350c-24 34-56 56-90 62c28-26 40-52 44-86c2-18 20-30 38-24c15 5 19 26 8 48Z"/>',
    '<circle cx="372" cy="340" r="150" fill="#07C160"/>',
    '<path fill="#07C160" d="M428 468c34 18 70 18 98 6c-36-6-58-22-80-50c-12-16-6-38 12-46c16-7 36 2 40 20c4 18-8 48-70 70Z"/>',
    "</g>",
  ].join(""),
};

const CHANNEL_ICONS: Partial<Record<ChannelType, BrandIcon>> = {
  telegram: createIconifyBrandIcon(telegram),
  discord: createIconifyBrandIcon(discordIcon),
  whatsapp: createIconifyBrandIcon(whatsappIcon),
  slack: createIconifyBrandIcon(slackIcon),
  wechat: createIconifyBrandIcon(weChatIcon),
  signal: createIconifyBrandIcon(signal),
};

export function getChannelBrandIcon(type: ChannelType): BrandIcon | null {
  return CHANNEL_ICONS[type] ?? null;
}
