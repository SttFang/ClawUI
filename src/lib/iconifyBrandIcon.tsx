import type { ComponentType } from "react";
import { Icon, type IconifyIcon } from "@iconify/react";

export type BrandIcon = ComponentType<{ size?: number; className?: string }>;

export function createIconifyBrandIcon(icon: IconifyIcon): BrandIcon {
  function IconifyBrandIcon({ size = 20, className }: { size?: number; className?: string }) {
    return <Icon icon={icon} width={size} height={size} className={className} />;
  }

  IconifyBrandIcon.displayName = "IconifyBrandIcon";
  return IconifyBrandIcon;
}
