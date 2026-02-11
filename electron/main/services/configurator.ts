import type { OnboardingOpenClawConfig } from "@clawui/types/config";
import type { BYOKConfig, SubscriptionConfig } from "@clawui/types/onboarding";
import { onboardingLog } from "../lib/logger";
import { ConfigRepository } from "./config-repository";

export { type BYOKConfig, type SubscriptionConfig };
export type OpenClawConfig = OnboardingOpenClawConfig;

export class ConfiguratorService {
  private readonly repository = new ConfigRepository();

  async configureSubscription(config: SubscriptionConfig): Promise<void> {
    onboardingLog.info("[config.subscription]");
    await this.repository.configureSubscription(config);
  }

  async configureBYOK(keys: BYOKConfig): Promise<void> {
    onboardingLog.info(
      "[config.byok]",
      `providers=${[keys.anthropic ? "anthropic" : "", keys.openai ? "openai" : ""].filter(Boolean).join(",")}`,
    );
    await this.repository.configureBYOK(keys);
  }

  async readConfig(): Promise<OpenClawConfig | null> {
    return this.repository.readOnboardingConfig();
  }

  async updateConfig(updates: Partial<OpenClawConfig>): Promise<void> {
    await this.repository.updateOnboardingConfig(updates);
  }

  async validateApiKey(provider: "anthropic" | "openai", apiKey: string): Promise<boolean> {
    if (provider === "anthropic") {
      return apiKey.startsWith("sk-ant-");
    }
    if (provider === "openai") {
      return apiKey.startsWith("sk-");
    }
    return false;
  }
}

export const configurator = new ConfiguratorService();
