import { pgTable, uuid, varchar, integer, text, jsonb } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_helpers";

export interface ModelConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/**
 * @rls Users can manage their own config
 * Policy: user_id = auth.uid()
 */
export const userConfigs = pgTable("user_configs", {
  userId: uuid("user_id").primaryKey(),
  defaultModel: varchar("default_model", { length: 100 }).default("claude-sonnet-4-5"),
  modelConfig: jsonb("model_config").$type<ModelConfig>().default({}),
  language: varchar("language", { length: 10 }).default("zh-CN"),
  theme: varchar("theme", { length: 20 }).default("auto"),
  gatewayPort: integer("gateway_port").default(18789),
  gatewayToken: text("gateway_token"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type UserConfig = typeof userConfigs.$inferSelect;
export type NewUserConfig = typeof userConfigs.$inferInsert;
