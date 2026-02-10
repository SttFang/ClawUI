import type { ChannelType } from "@/store/channels";
import type { BrandIcon } from "@/lib/iconifyBrandIcon";
import { createIconifyBrandIcon } from "@/lib/iconifyBrandIcon";
import discordIcon from "@iconify/icons-logos/discord-icon";
import signal from "@iconify/icons-logos/signal";
import slackIcon from "@iconify/icons-logos/slack-icon";
import telegram from "@iconify/icons-logos/telegram";
import whatsappIcon from "@iconify/icons-logos/whatsapp-icon";

const WeChatLogo: BrandIcon = ({ size = 20, className }) => {
  // Simple 2-color approximation (green + white). Good enough for UI branding.
  const s = Number(size) || 20;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="32" r="30" fill="#07C160" />
      <path
        fill="#FFFFFF"
        d="M25.4 20.5c-8.2 0-14.9 5.2-14.9 11.7c0 3.7 2.1 7 5.6 9.1l-1.3 5.4l5.8-3.2c1.5.4 3 .6 4.8.6c8.2 0 14.9-5.2 14.9-11.7s-6.7-11.9-14.9-11.9Zm-6 9.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 0 1 0-4.4Zm12 0a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 0 1 0-4.4Z"
      />
      <path
        fill="#FFFFFF"
        opacity="0.92"
        d="M40.8 28.2c-1 0-2 .1-3 .3c.6 1.2 1 2.6 1 4.1c0 6.8-6.5 12.4-15 13.2c2.4 4.1 7.7 6.9 13.8 6.9c1.5 0 2.9-.2 4.3-.5l5.7 3.1l-1.3-5.3c3.1-1.9 5-4.8 5-8c0-5.5-4.8-9.8-10.5-9.8Zm-2.8 10a1.9 1.9 0 1 1 0 3.8a1.9 1.9 0 0 1 0-3.8Zm9 0a1.9 1.9 0 1 1 0 3.8a1.9 1.9 0 0 1 0-3.8Z"
      />
    </svg>
  );
};

const CHANNEL_ICONS: Partial<Record<ChannelType, BrandIcon>> = {
  telegram: createIconifyBrandIcon(telegram),
  discord: createIconifyBrandIcon(discordIcon),
  whatsapp: createIconifyBrandIcon(whatsappIcon),
  slack: createIconifyBrandIcon(slackIcon),
  wechat: WeChatLogo,
  signal: createIconifyBrandIcon(signal),
};

export function getChannelBrandIcon(type: ChannelType): BrandIcon | null {
  return CHANNEL_ICONS[type] ?? null;
}
