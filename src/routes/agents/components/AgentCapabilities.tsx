import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToolsStore, selectToolsConfig, selectTools } from "@/store/tools";

export function AgentCapabilities() {
  const { t } = useTranslation("common");
  const tools = useToolsStore(selectTools);
  const toolsConfig = useToolsStore(selectToolsConfig);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t("agents.sections.capabilities.title")}
            </CardTitle>
            <CardDescription>{t("agents.sections.capabilities.description")}</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="#/tools">{t("agents.actions.manageTools")}</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{t("agents.tools.access")}</div>
            <div className="font-medium">{toolsConfig.accessMode}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{t("agents.tools.sandbox")}</div>
            <div className="font-medium">
              {toolsConfig.sandboxEnabled
                ? t("agents.values.enabled")
                : t("agents.values.disabled")}
            </div>
          </div>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">{t("agents.tools.enabledTools")}: </span>
          <span>{tools.filter((x) => x.enabled).length}</span>
        </div>
        <div className="text-xs text-muted-foreground">{t("agents.tools.policyNote")}</div>
      </CardContent>
    </Card>
  );
}
