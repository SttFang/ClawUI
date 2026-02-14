import type { ChangeEvent } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  Switch,
} from "@clawui/ui";
import { ChevronDown, Shield, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useConfigManager } from "@/hooks/useConfigManager";
import { isCapabilitiesSection, type CapabilitiesSection } from "@/router/settingsRouteSchema";
import { configCoreManager } from "@/store/configDraft/manager";
import {
  useToolsStore,
  selectAccessMode,
  selectToolsConfig,
  selectIsLoading,
  type ExecAskMode,
  type ExecHostMode,
  type ExecSecurityMode,
  type ToolAccessMode,
} from "@/store/tools";
import { PluginsSection } from "./config/PluginsSection";
import { SkillsSection } from "./config/SkillsSection";

const accessModes: { value: ToolAccessMode; icon: React.ReactNode }[] = [
  { value: "auto", icon: <ShieldCheck className="h-5 w-5" /> },
  { value: "ask", icon: <ShieldQuestion className="h-5 w-5" /> },
  { value: "deny", icon: <ShieldX className="h-5 w-5" /> },
];

const execHostOptions: ExecHostMode[] = ["sandbox", "gateway", "node"];
const execAskOptions: ExecAskMode[] = ["off", "on-miss", "always"];
const execSecurityOptions: ExecSecurityMode[] = ["deny", "allowlist", "full"];

const SECURITY_PATHS = {
  allowElevatedWebchat: {
    path: ["tools", "elevated", "allowFrom", "webchat"],
    default: false as const,
  },
  allowElevatedDiscord: {
    path: ["tools", "elevated", "allowFrom", "discord"],
    default: false as const,
  },
  sandboxMode: {
    path: ["agents", "defaults", "sandbox", "mode"],
    default: "off" as const,
  },
  workspaceAccess: {
    path: ["agents", "defaults", "sandbox", "workspaceAccess"],
    default: "rw" as const,
  },
};

function parsePolicyList(value: string): string[] {
  const entries = value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(entries));
}

export function CapabilitiesTab() {
  const { t } = useTranslation("common");
  const [searchParams] = useSearchParams();

  const sectionParam = searchParams.get("section");
  const activeSection: CapabilitiesSection | null = isCapabilitiesSection(sectionParam)
    ? sectionParam
    : null;

  // Refs for scroll anchors
  const toolsRef = useRef<HTMLElement>(null);
  const skillsRef = useRef<HTMLElement>(null);
  const pluginsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ref =
      activeSection === "tools"
        ? toolsRef
        : activeSection === "skills"
          ? skillsRef
          : activeSection === "plugins"
            ? pluginsRef
            : null;
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSection]);

  // Tools state
  const accessMode = useToolsStore(selectAccessMode);
  const config = useToolsStore(selectToolsConfig);
  const isToolsLoading = useToolsStore(selectIsLoading);
  const loadTools = useToolsStore((s) => s.loadTools);
  const setAccessMode = useToolsStore((s) => s.setAccessMode);
  const setExecHost = useToolsStore((s) => s.setExecHost);
  const setExecAsk = useToolsStore((s) => s.setExecAsk);
  const setExecSecurity = useToolsStore((s) => s.setExecSecurity);
  const setPolicyLists = useToolsStore((s) => s.setPolicyLists);
  const toggleSandbox = useToolsStore((s) => s.toggleSandbox);
  const [allowInput, setAllowInput] = useState("");
  const [denyInput, setDenyInput] = useState("");

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  useEffect(() => {
    setAllowInput(config.allowList.join(", "));
    setDenyInput(config.denyList.join(", "));
  }, [config.allowList, config.denyList]);

  const parsedAllowList = useMemo(() => parsePolicyList(allowInput), [allowInput]);
  const parsedDenyList = useMemo(() => parsePolicyList(denyInput), [denyInput]);

  // Security state
  const security = useConfigManager({
    manager: configCoreManager,
    paths: SECURITY_PATHS,
    messages: { loadFailed: t("settings.page.security.messages.loadFailed") },
  });

  const handleSecurityApply = () => {
    security.apply({
      onSuccess: () => security.setMessage(t("settings.page.security.messages.updated")),
    });
  };

  return (
    <div className="space-y-8">
      {/* Tool Access Control */}
      <section ref={toolsRef} className="scroll-mt-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">{t("tools.title")}</h2>
          <p className="text-muted-foreground">{t("tools.description")}</p>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle>{t("tools.accessControl.title")}</CardTitle>
            </div>
            <CardDescription>{t("tools.accessControl.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {accessModes.map((mode) => {
                const labelKey = `tools.accessModes.${mode.value}.label` as const;
                const descKey = `tools.accessModes.${mode.value}.description` as const;
                return (
                  <button
                    key={mode.value}
                    onClick={() => void setAccessMode(mode.value)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      accessMode === mode.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {mode.icon}
                      <span className="font-medium">{t(labelKey)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t(descKey)}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {t("tools.accessControl.realPolicyHint")}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Skills */}
      <section ref={skillsRef} className="pt-8 border-t scroll-mt-6">
        <SkillsSection />
      </section>

      {/* Plugins */}
      <section ref={pluginsRef} className="pt-8 border-t scroll-mt-6">
        <PluginsSection />
      </section>

      {/* Advanced: exec config, sandbox, policy lists, security */}
      <section className="pt-8 border-t">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              {t("settings.page.capabilities.advanced")}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Exec Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>{t("tools.exec.title")}</CardTitle>
                <CardDescription>{t("tools.exec.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t("tools.exec.hostLabel")}</div>
                    <Select
                      value={config.execHost}
                      onChange={(event) => void setExecHost(event.target.value as ExecHostMode)}
                      disabled={isToolsLoading}
                    >
                      {execHostOptions.map((host) => (
                        <option key={host} value={host}>
                          {t(`tools.exec.hostOptions.${host}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t("tools.exec.askLabel")}</div>
                    <Select
                      value={config.execAsk}
                      onChange={(event) => void setExecAsk(event.target.value as ExecAskMode)}
                      disabled={isToolsLoading}
                    >
                      {execAskOptions.map((ask) => (
                        <option key={ask} value={ask}>
                          {t(`tools.exec.askOptions.${ask}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t("tools.exec.securityLabel")}</div>
                    <Select
                      value={config.execSecurity}
                      onChange={(event) =>
                        void setExecSecurity(event.target.value as ExecSecurityMode)
                      }
                      disabled={isToolsLoading}
                    >
                      {execSecurityOptions.map((s) => (
                        <option key={s} value={s}>
                          {t(`tools.exec.securityOptions.${s}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("tools.exec.policyHint")}</p>
              </CardContent>
            </Card>

            {/* Sandbox */}
            <Card>
              <CardHeader>
                <CardTitle>{t("tools.sandbox.title")}</CardTitle>
                <CardDescription>{t("tools.sandbox.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("tools.sandbox.enableTitle")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("tools.sandbox.enableDescription")}
                    </p>
                  </div>
                  <Switch
                    checked={config.sandboxEnabled}
                    onCheckedChange={(v) => void toggleSandbox(v)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Policy Lists */}
            <Card>
              <CardHeader>
                <CardTitle>{t("tools.policyList.title")}</CardTitle>
                <CardDescription>{t("tools.policyList.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t("tools.policyList.allowLabel")}</div>
                  <Input
                    value={allowInput}
                    onChange={(event) => setAllowInput(event.target.value)}
                    placeholder={t("tools.policyList.allowPlaceholder")}
                  />
                  <div className="text-xs text-muted-foreground">
                    {t("tools.policyList.count", {
                      allow: parsedAllowList.length,
                      deny: parsedDenyList.length,
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t("tools.policyList.denyLabel")}</div>
                  <Input
                    value={denyInput}
                    onChange={(event) => setDenyInput(event.target.value)}
                    placeholder={t("tools.policyList.denyPlaceholder")}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={isToolsLoading}
                  onClick={() =>
                    void setPolicyLists({
                      allowList: parsedAllowList,
                      denyList: parsedDenyList,
                    })
                  }
                >
                  {t("tools.policyList.save")}
                </Button>
              </CardContent>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.page.security.title")}</CardTitle>
                <CardDescription>{t("settings.page.security.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {security.message ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {security.message}
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t("settings.page.security.allowElevatedWebchat")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.page.security.allowElevatedWebchatHint")}
                    </p>
                  </div>
                  <Switch
                    checked={security.fields.allowElevatedWebchat as boolean}
                    onCheckedChange={(v) => security.setField("allowElevatedWebchat", v)}
                    disabled={security.loading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t("settings.page.security.allowElevatedDiscord")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.page.security.allowElevatedDiscordHint")}
                    </p>
                  </div>
                  <Switch
                    checked={security.fields.allowElevatedDiscord as boolean}
                    onCheckedChange={(v) => security.setField("allowElevatedDiscord", v)}
                    disabled={security.loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("settings.page.security.sandboxMode")}</Label>
                  <Select
                    value={security.fields.sandboxMode as string}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      security.setField("sandboxMode", e.target.value)
                    }
                    disabled={security.loading}
                  >
                    <option value="off">
                      {t("settings.page.security.sandboxModeOptions.off")}
                    </option>
                    <option value="non-main">
                      {t("settings.page.security.sandboxModeOptions.nonMain")}
                    </option>
                    <option value="all">
                      {t("settings.page.security.sandboxModeOptions.all")}
                    </option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("settings.page.security.workspaceAccess")}</Label>
                  <Select
                    value={security.fields.workspaceAccess as string}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      security.setField("workspaceAccess", e.target.value)
                    }
                    disabled={security.loading}
                  >
                    <option value="none">
                      {t("settings.page.security.workspaceAccessOptions.none")}
                    </option>
                    <option value="ro">
                      {t("settings.page.security.workspaceAccessOptions.ro")}
                    </option>
                    <option value="rw">
                      {t("settings.page.security.workspaceAccessOptions.rw")}
                    </option>
                  </Select>
                </div>

                <Button disabled={security.loading} onClick={handleSecurityApply}>
                  {t("settings.page.security.actions.apply")}
                </Button>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </section>
    </div>
  );
}
