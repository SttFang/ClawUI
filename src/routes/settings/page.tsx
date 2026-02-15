import { Tabs, TabsContent, TabsList, TabsTrigger } from "@clawui/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { RescueLayout } from "@/features/RescueAgent";
import {
  isSettingsTab,
  resolveTabFromSection,
  type SettingsTab,
} from "@/router/settingsRouteSchema";
import { useSecretsStore } from "@/store/secrets";
import { useSettingsStore } from "@/store/settings";
import { AiServicesTab } from "./AiServicesTab";
import { CapabilitiesTab } from "./CapabilitiesTab";
import { GeneralTab } from "./GeneralTab";
import { MessagingTab } from "./MessagingTab";

export default function SettingsPage() {
  const { t } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadPreferences = useSettingsStore((s) => s.loadPreferences);
  const loadModelsStatus = useSettingsStore((s) => s.loadModelsStatus);
  const loadSecrets = useSecretsStore((s) => s.load);

  useEffect(() => {
    loadSettings();
    loadPreferences();
    loadModelsStatus();
    loadSecrets();
  }, [loadSettings, loadPreferences, loadModelsStatus, loadSecrets]);

  const tabParam = searchParams.get("tab");
  const sectionParam = searchParams.get("section");
  const activeTab: SettingsTab = isSettingsTab(tabParam)
    ? tabParam
    : resolveTabFromSection(sectionParam);

  const handleTabChange = (nextTab: string) => {
    if (!isSettingsTab(nextTab)) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    nextParams.delete("section");
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <RescueLayout>
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">{t("settings.page.title")}</h1>
            <p className="text-muted-foreground">{t("settings.page.description")}</p>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-6 h-auto bg-transparent p-0 border-b rounded-none w-full justify-start gap-6">
              {(["general", "ai", "messaging", "capabilities"] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-none border-b-2 border-transparent px-0 pb-2.5 pt-1 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {t(`settings.page.tabs.${tab}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="general">
              <GeneralTab />
            </TabsContent>
            <TabsContent value="ai">
              <AiServicesTab />
            </TabsContent>
            <TabsContent value="messaging">
              <MessagingTab />
            </TabsContent>
            <TabsContent value="capabilities">
              <CapabilitiesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </RescueLayout>
  );
}
