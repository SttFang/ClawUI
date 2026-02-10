import { pgTable, text, uuid, varchar, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, updatedAt, idGenerator } from "./_helpers";

/**
 * @rls Users can only access their own API keys
 * Policy: user_id = auth.uid()
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => idGenerator("apiKey")),
    userId: uuid("user_id").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(), // anthropic, openai, etc.
    encryptedKey: text("encrypted_key").notNull(),
    keyPreview: varchar("key_preview", { length: 20 }), // e.g., "sk-...xxxx"
    isActive: boolean("is_active").default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("api_keys_user_idx").on(t.userId),
    uniqueIndex("api_keys_user_provider_unique").on(t.userId, t.provider),
  ],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
