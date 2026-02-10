import { Tabs, TabsContent, TabsList, TabsTrigger } from "@clawui/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Subscription } from "@/features/Subscription";
import { useSettingsStore } from "@/store/settings";
import { useSecretsStore } from "@/store/secrets";
import { GeneralTab } from "./GeneralTab";
import { ApiTab } from "./ApiTab";
import { TokensTab } from "./TokensTab";
import { GatewayTab } from "./GatewayTab";
import { SecurityTab } from "./SecurityTab";
import { AboutTab } from "./AboutTab";

export default function SettingsPage() {
  const { t } = useTranslation("common");

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

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t("settings.page.title")}</h1>
          <p className="text-muted-foreground">{t("settings.page.description")}</p>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="mb-4">
            <TabsTrigger value="general">{t("settings.page.tabs.general")}</TabsTrigger>
            <TabsTrigger value="api">{t("settings.page.tabs.api")}</TabsTrigger>
            <TabsTrigger value="tokens">{t("settings.page.tabs.tokens")}</TabsTrigger>
            <TabsTrigger value="gateway">{t("settings.page.tabs.gateway")}</TabsTrigger>
            <TabsTrigger value="security">{t("settings.page.tabs.security")}</TabsTrigger>
            <TabsTrigger value="subscription">{t("settings.page.tabs.subscription")}</TabsTrigger>
            <TabsTrigger value="about">{t("settings.page.tabs.about")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralTab />
          </TabsContent>
          <TabsContent value="api">
            <ApiTab />
          </TabsContent>
          <TabsContent value="tokens">
            <TokensTab />
          </TabsContent>
          <TabsContent value="gateway">
            <GatewayTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>
          <TabsContent value="subscription">
            <Subscription />
          </TabsContent>
          <TabsContent value="about">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
