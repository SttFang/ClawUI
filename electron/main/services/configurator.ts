import type { OnboardingOpenClawConfig } from "@clawui/types/config";
import type { BYOKConfig, SubscriptionConfig } from "@clawui/types/onboarding";
import { onboardingLog } from "../lib/logger";
import { ConfigService } from "./config";
import { ConfigRepository } from "./config-repository";
import type { CredentialService } from "./credential-service";

export { type BYOKConfig, type SubscriptionConfig };
export type OpenClawConfig = OnboardingOpenClawConfig;

export class ConfiguratorService {
  private readonly repository: ConfigRepository;
  private credentialService: CredentialService | null = null;

  constructor(configService?: ConfigService) {
    this.repository = new ConfigRepository(configService ?? new ConfigService());
  }

  setCredentialService(credentialService: CredentialService): void {
    this.credentialService = credentialService;
  }

  async configureSubscription(config: SubscriptionConfig): Promise<void> {
    onboardingLog.info("[config.subscription]");
    if (this.credentialService) {
      await this.credentialService.setProxy({
        proxyUrl: config.proxyUrl,
        proxyToken: config.proxyToken,
      });
    } else {
      await this.repository.configureSubscription(config);
    }
  }

  async configureBYOK(keys: BYOKConfig): Promise<void> {
    onboardingLog.info(
      "[config.byok]",
      `providers=${[keys.anthropic ? "anthropic" : "", keys.openai ? "openai" : ""].filter(Boolean).join(",")}`,
    );
    if (this.credentialService) {
      if (keys.anthropic) {
        await this.credentialService.setLlmKey({ provider: "anthropic", apiKey: keys.anthropic });
      }
      if (keys.openai) {
        await this.credentialService.setLlmKey({ provider: "openai", apiKey: keys.openai });
      }
    } else {
      await this.repository.configureBYOK(keys);
    }
  }

  async readConfig(): Promise<OpenClawConfig | null> {
    return this.repository.readOnboardingConfig();
  }

  async updateConfig(updates: Partial<OpenClawConfig>): Promise<void> {
    await this.repository.updateOnboardingConfig(updates);
  }

  async validateApiKey(provider: "anthropic" | "openai", apiKey: string): Promise<boolean> {
    if (this.credentialService) {
      return this.credentialService.validateLlmKey(provider, apiKey).valid;
    }
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
