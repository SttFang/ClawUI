import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Switch,
} from "@clawui/ui";
import { Shield, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

const accessModes: { value: ToolAccessMode; icon: React.ReactNode }[] = [
  { value: "auto", icon: <ShieldCheck className="h-5 w-5" /> },
  { value: "ask", icon: <ShieldQuestion className="h-5 w-5" /> },
  { value: "deny", icon: <ShieldX className="h-5 w-5" /> },
];

const execHostOptions: ExecHostMode[] = ["sandbox", "gateway", "node"];
const execAskOptions: ExecAskMode[] = ["off", "on-miss", "always"];
const execSecurityOptions: ExecSecurityMode[] = ["deny", "allowlist", "full"];

function parsePolicyList(value: string): string[] {
  const entries = value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(entries));
}

export function ToolsSection() {
  const { t } = useTranslation("common");
  const accessMode = useToolsStore(selectAccessMode);
  const config = useToolsStore(selectToolsConfig);
  const isLoading = useToolsStore(selectIsLoading);

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

  return (
    <>
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

      <Card className="mb-4">
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
                disabled={isLoading}
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
                disabled={isLoading}
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
                onChange={(event) => void setExecSecurity(event.target.value as ExecSecurityMode)}
                disabled={isLoading}
              >
                {execSecurityOptions.map((security) => (
                  <option key={security} value={security}>
                    {t(`tools.exec.securityOptions.${security}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("tools.exec.policyHint")}</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
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

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={isLoading}
              onClick={() =>
                void setPolicyLists({
                  allowList: parsedAllowList,
                  denyList: parsedDenyList,
                })
              }
            >
              {t("tools.policyList.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
