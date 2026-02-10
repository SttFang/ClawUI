import type { ComponentType } from "react";
import type { ChannelType } from "@/store/channels";
import { SiDiscord, SiSignal, SiSlack, SiTelegram, SiWechat, SiWhatsapp } from "react-icons/si";

export type BrandIcon = ComponentType<{ size?: number; className?: string }>;

const CHANNEL_ICONS: Partial<Record<ChannelType, BrandIcon>> = {
  telegram: SiTelegram,
  discord: SiDiscord,
  whatsapp: SiWhatsapp,
  slack: SiSlack,
  wechat: SiWechat,
  signal: SiSignal,
};

export function getChannelBrandIcon(type: ChannelType): BrandIcon | null {
  return CHANNEL_ICONS[type] ?? null;
}

