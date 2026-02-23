import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { subscriptionLog } from "@/lib/logger";
import { createWeakCachedSelector } from "@/store/utils/createWeakCachedSelector";

export type PlanType = "free" | "pro" | "team";

export interface SubscriptionPlan {
  id: PlanType;
  price: number; // monthly, USD
  limits: {
    tokensPerMonth: number;
    apiCallsPerDay: number;
    channels: number;
    mcpServers: number;
  };
}

export interface Usage {
  tokensUsed: number;
  tokensLimit: number;
  apiCallsToday: number;
  apiCallsLimit: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

interface SubscriptionState {
  currentPlan: PlanType;
  usage: Usage | null;
  plans: SubscriptionPlan[];
  isLoading: boolean;
  isUpgrading: boolean;
  error: string | null;
}

interface SubscriptionActions {
  loadSubscription: () => Promise<void>;
  upgradePlan: (planId: PlanType) => Promise<void>;
  refreshUsage: () => Promise<void>;
}

type SubscriptionStore = SubscriptionState & SubscriptionActions;

const plans: SubscriptionPlan[] = [
  {
    id: "free",
    price: 0,
    limits: { tokensPerMonth: 100000, apiCallsPerDay: 100, channels: 1, mcpServers: 1 },
  },
  {
    id: "pro",
    price: 19,
    limits: { tokensPerMonth: 1000000, apiCallsPerDay: 1000, channels: 5, mcpServers: 10 },
  },
  {
    id: "team",
    price: 49,
    limits: { tokensPerMonth: 5000000, apiCallsPerDay: 5000, channels: -1, mcpServers: -1 },
  },
];

const initialState: SubscriptionState = {
  currentPlan: "free",
  usage: null,
  plans,
  isLoading: false,
  isUpgrading: false,
  error: null,
};

// TODO: 接入真实 API — 当前所有 action 使用 mock 数据
export const useSubscriptionStore = create<SubscriptionStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadSubscription: async () => {
        set({ isLoading: true, error: null }, false, "loadSubscription");
        try {
          // TODO: replace with real API call
          await new Promise((resolve) => setTimeout(resolve, 500));

          const now = new Date();
          const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          set(
            {
              usage: {
                tokensUsed: 45000,
                tokensLimit: 100000,
                apiCallsToday: 42,
                apiCallsLimit: 100,
                billingPeriodStart: periodStart.toISOString(),
                billingPeriodEnd: periodEnd.toISOString(),
              },
              isLoading: false,
            },
            false,
            "loadSubscription/success",
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load subscription";
          set({ error: message, isLoading: false }, false, "loadSubscription/error");
        }
      },

      upgradePlan: async (planId) => {
        const { currentPlan } = get();
        if (planId === currentPlan) return;

        set({ isUpgrading: true, error: null }, false, "upgradePlan");
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const newPlan = plans.find((p) => p.id === planId);
          if (!newPlan) {
            throw new Error("Invalid plan selected");
          }

          set(
            {
              currentPlan: planId,
              usage: get().usage
                ? {
                    ...get().usage!,
                    tokensLimit: newPlan.limits.tokensPerMonth,
                    apiCallsLimit: newPlan.limits.apiCallsPerDay,
                  }
                : null,
              isUpgrading: false,
            },
            false,
            "upgradePlan/success",
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to upgrade plan";
          set({ error: message, isUpgrading: false }, false, "upgradePlan/error");
        }
      },

      refreshUsage: async () => {
        const { currentPlan } = get();
        const currentPlanData = plans.find((p) => p.id === currentPlan);

        try {
          await new Promise((resolve) => setTimeout(resolve, 300));

          const now = new Date();
          const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          set(
            {
              usage: {
                tokensUsed: Math.floor(Math.random() * 50000) + 40000,
                tokensLimit: currentPlanData?.limits.tokensPerMonth || 100000,
                apiCallsToday: Math.floor(Math.random() * 50) + 30,
                apiCallsLimit: currentPlanData?.limits.apiCallsPerDay || 100,
                billingPeriodStart: periodStart.toISOString(),
                billingPeriodEnd: periodEnd.toISOString(),
              },
            },
            false,
            "refreshUsage",
          );
        } catch (error) {
          subscriptionLog.error("Failed to refresh usage:", error);
        }
      },
    }),
    { name: "SubscriptionStore" },
  ),
);

// Selectors
export const selectCurrentPlan = (state: SubscriptionStore) => state.currentPlan;
export const selectUsage = (state: SubscriptionStore) => state.usage;
export const selectPlans = (state: SubscriptionStore) => state.plans;
export const selectIsLoading = (state: SubscriptionStore) => state.isLoading;
export const selectIsUpgrading = (state: SubscriptionStore) => state.isUpgrading;
export const selectError = (state: SubscriptionStore) => state.error;

export const selectUsagePercentage = createWeakCachedSelector((state: SubscriptionStore) => {
  if (!state.usage) return { tokens: 0, apiCalls: 0 };
  return {
    tokens: Math.round((state.usage.tokensUsed / state.usage.tokensLimit) * 100),
    apiCalls: Math.round((state.usage.apiCallsToday / state.usage.apiCallsLimit) * 100),
  };
});

export const subscriptionSelectors = {
  selectCurrentPlan,
  selectUsage,
  selectPlans,
  selectIsLoading,
  selectIsUpgrading,
  selectError,
  selectUsagePercentage,
};
