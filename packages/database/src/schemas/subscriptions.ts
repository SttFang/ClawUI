import { pgTable, text, uuid, varchar, integer, date, index } from "drizzle-orm/pg-core";
import { createdAt, updatedAt, idGenerator } from "./_helpers";

export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing";
export type PlanId = "free" | "pro" | "team" | "enterprise";

/**
 * @rls Users can view their own subscription
 * Policy: user_id = auth.uid() FOR SELECT
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => idGenerator("sub")),
    userId: uuid("user_id").notNull().unique(),
    planId: varchar("plan_id", { length: 50 }).$type<PlanId>().notNull().default("free"),
    status: varchar("status", { length: 20 }).$type<SubscriptionStatus>().default("active"),
    tokensUsed: integer("tokens_used").default(0),
    tokensLimit: integer("tokens_limit").default(100000), // Free tier limit
    billingPeriodStart: date("billing_period_start").notNull(),
    billingPeriodEnd: date("billing_period_end").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
