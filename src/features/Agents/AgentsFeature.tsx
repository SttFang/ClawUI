import { Button } from "@clawui/ui";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentCapabilities } from "./components/AgentCapabilities";
import { AgentExtensions } from "./components/AgentExtensions";
import { AgentIdentity } from "./components/AgentIdentity";
import { AgentInputs } from "./components/AgentInputs";
import { AgentList } from "./components/AgentList";
import { AgentSkills } from "./components/AgentSkills";
import { CronDialog } from "./components/CronDialog";
import { CronPanel } from "./components/CronPanel";
import { CronRunsDialog } from "./components/CronRunsDialog";
import { useAgentsData, useAgentsExport } from "./hooks";

export function AgentsFeature() {
  const { t } = useTranslation("common");
  const data = useAgentsData();
  const { handleExport } = useAgentsExport(data);
  const { configError, cronDialogOpen, setCronDialogOpen, handleOpenCronDialog } = data;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{t("agents.title")}</h1>
            <p className="text-muted-foreground">{t("agents.description")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            {t("agents.actions.exportJson")}
          </Button>
        </div>

        {configError && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <div className="font-medium text-destructive">{t("agents.errorTitle")}</div>
            <div className="text-sm text-destructive/90">{configError}</div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <AgentList />

          <div className="space-y-4">
            <AgentIdentity />
            <AgentInputs />
            <AgentCapabilities />
            <AgentExtensions />
            <AgentSkills />
            <CronPanel onOpenDialog={handleOpenCronDialog} />
          </div>
        </div>
      </div>

      <CronDialog open={cronDialogOpen} onOpenChange={setCronDialogOpen} />
      <CronRunsDialog />
    </div>
  );
}
