import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@clawui/ui";
import { CreditCard, Zap, Users, Check, Loader2, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useSubscriptionStore,
  selectCurrentPlan,
  selectUsage,
  selectPlans,
  selectIsLoading,
  selectIsUpgrading,
  type PlanType,
} from "@/store/subscription";

const PLAN_FEATURE_KEYS: Record<PlanType, readonly string[]> = {
  free: [
    "subscription.plans.free.features.basicAiChat",
    "subscription.plans.free.features.oneChannel",
    "subscription.plans.free.features.oneMcpServer",
    "subscription.plans.free.features.communitySupport",
  ],
  pro: [
    "subscription.plans.pro.features.unlimitedAiChat",
    "subscription.plans.pro.features.fiveChannels",
    "subscription.plans.pro.features.tenMcpServers",
    "subscription.plans.pro.features.prioritySupport",
    "subscription.plans.pro.features.advancedTools",
  ],
  team: [
    "subscription.plans.team.features.everythingInPro",
    "subscription.plans.team.features.unlimitedChannels",
    "subscription.plans.team.features.unlimitedMcpServers",
    "subscription.plans.team.features.teamCollaboration",
    "subscription.plans.team.features.adminDashboard",
  ],
};

function UsageBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isOverLimit ? "text-destructive" : isNearLimit ? "text-amber-500" : ""}>
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isOverLimit ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isCurrent,
  isUpgrading,
  onUpgrade,
}: {
  plan: {
    id: PlanType;
    price: number;
    limits: {
      tokensPerMonth: number;
      apiCallsPerDay: number;
      channels: number;
      mcpServers: number;
    };
  };
  isCurrent: boolean;
  isUpgrading: boolean;
  onUpgrade: (planId: PlanType) => void;
}) {
  const { t } = useTranslation("common");
  const isTeamPlan = plan.id === "team";
  const isProPlan = plan.id === "pro";
  const planName = t(`subscription.plans.${plan.id}.name`);
  const features = PLAN_FEATURE_KEYS[plan.id].map((key) => t(key));

  const tokensText =
    plan.limits.tokensPerMonth === -1
      ? t("subscription.planCard.unlimited")
      : t("subscription.planCard.tokensPerMonth", {
          n: (plan.limits.tokensPerMonth / 1000000).toFixed(1),
        });
  const apiCallsText =
    plan.limits.apiCallsPerDay === -1
      ? t("subscription.planCard.unlimited")
      : t("subscription.planCard.apiCallsPerDay", {
          n: plan.limits.apiCallsPerDay.toLocaleString(),
        });
  const channelsText =
    plan.limits.channels === -1 ? t("subscription.planCard.unlimited") : `${plan.limits.channels}`;
  const mcpServersText =
    plan.limits.mcpServers === -1
      ? t("subscription.planCard.unlimited")
      : `${plan.limits.mcpServers}`;

  return (
    <Card className={`relative ${isCurrent ? "border-primary ring-2 ring-primary/20" : ""}`}>
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs rounded-full">
          {t("subscription.planCard.badges.current")}
        </div>
      )}
      {isProPlan && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-xs rounded-full">
          {t("subscription.planCard.badges.popular")}
        </div>
      )}
      <CardHeader className="text-center pb-2">
        <CardTitle className="flex items-center justify-center gap-2">
          {plan.id === "free" && <Zap className="h-5 w-5" />}
          {plan.id === "pro" && <CreditCard className="h-5 w-5" />}
          {plan.id === "team" && <Users className="h-5 w-5" />}
          {planName}
        </CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">${plan.price}</span>
          <span className="text-muted-foreground">{t("subscription.planCard.perMonth")}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
          <div>
            {t("subscription.planCard.limits.tokens")}: {tokensText}
          </div>
          <div>
            {t("subscription.planCard.limits.apiCalls")}: {apiCallsText}
          </div>
          <div>
            {t("subscription.planCard.limits.channels")}: {channelsText}
          </div>
          <div>
            {t("subscription.planCard.limits.mcpServers")}: {mcpServersText}
          </div>
        </div>
        <Button
          className="w-full"
          variant={
            isCurrent ? "outline" : isTeamPlan ? "default" : isProPlan ? "default" : "outline"
          }
          disabled={isCurrent || isUpgrading}
          onClick={() => onUpgrade(plan.id)}
        >
          {isUpgrading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("subscription.planCard.processing")}
            </>
          ) : isCurrent ? (
            t("subscription.planCard.current")
          ) : plan.price === 0 ? (
            t("subscription.planCard.downgrade")
          ) : (
            t("subscription.planCard.upgrade")
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function Subscription() {
  const { t, i18n } = useTranslation("common");
  const currentPlan = useSubscriptionStore(selectCurrentPlan);
  const usage = useSubscriptionStore(selectUsage);
  const plans = useSubscriptionStore(selectPlans);
  const isLoading = useSubscriptionStore(selectIsLoading);
  const isUpgrading = useSubscriptionStore(selectIsUpgrading);

  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);
  const upgradePlan = useSubscriptionStore((s) => s.upgradePlan);
  const refreshUsage = useSubscriptionStore((s) => s.refreshUsage);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan & Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("subscription.current.title", {
                  name: t(`subscription.plans.${currentPlan}.name`),
                })}
              </CardTitle>
              <CardDescription>
                {usage && (
                  <>
                    {t("subscription.current.billingPeriod", {
                      start: formatDate(usage.billingPeriodStart),
                      end: formatDate(usage.billingPeriodEnd),
                    })}
                  </>
                )}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshUsage}
              aria-label={t("subscription.actions.refresh")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usage && (
            <>
              <UsageBar
                value={usage.tokensUsed}
                max={usage.tokensLimit}
                label={t("subscription.usage.tokenUsage")}
              />
              <UsageBar
                value={usage.apiCallsToday}
                max={usage.apiCallsLimit}
                label={t("subscription.usage.apiCallsToday")}
              />
              <div className="flex gap-4 pt-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span className="text-muted-foreground">{t("subscription.legend.normal")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span className="text-muted-foreground">
                    {t("subscription.legend.nearLimit")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-destructive" />
                  <span className="text-muted-foreground">
                    {t("subscription.legend.overLimit")}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t("subscription.availablePlans")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={currentPlan === plan.id}
              isUpgrading={isUpgrading}
              onUpgrade={upgradePlan}
            />
          ))}
        </div>
      </div>

      {/* Additional Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t("subscription.info.enterprisePrefix")}{" "}
              <a href="mailto:sales@clawui.com" className="text-primary hover:underline">
                sales@clawui.com
              </a>{" "}
              {t("subscription.info.enterpriseSuffix")}
            </p>
            <p>{t("subscription.info.trial")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Subscription;
