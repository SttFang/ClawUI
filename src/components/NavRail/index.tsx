import { OpenClaw } from "@lobehub/icons";
import { MessageSquare, Bot, BarChart3, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
const navItems = [
  { to: "/", icon: MessageSquare, labelKey: "nav:chat" },
  { to: "/agents", icon: Bot, labelKey: "nav:agents" },
  { to: "/usage", icon: BarChart3, labelKey: "nav:usage" },
  { to: "/settings", icon: Settings, labelKey: "nav:settings" },
];

export function NavRail() {
  const { t } = useTranslation();

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center bg-sidebar pb-3 pt-3">
      {/* Logo */}
      <div className="mb-4">
        <OpenClaw.Color size={36} />
      </div>

      {/* Divider */}
      <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground",
              )
            }
            title={t(item.labelKey)}
            aria-label={t(item.labelKey)}
          >
            <item.icon size={18} aria-hidden="true" />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
