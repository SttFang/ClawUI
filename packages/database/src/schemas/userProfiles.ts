import { pgTable, uuid, varchar, boolean, text } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_helpers";

/**
 * @rls Users can only access their own profile
 * Policy: user_id = auth.uid()
 */
export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  avatar: text("avatar"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
