import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@clawui/ui'
import {
  useSubscriptionStore,
  selectCurrentPlan,
  selectCurrentPlanData,
  selectUsage,
  selectPlans,
  selectIsLoading,
  selectIsUpgrading,
  type PlanType,
} from '@/store/subscription'
import { CreditCard, Zap, Users, Check, Loader2, RefreshCw } from 'lucide-react'

function UsageBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  const isNearLimit = percentage >= 80
  const isOverLimit = percentage >= 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isOverLimit ? 'text-destructive' : isNearLimit ? 'text-amber-500' : ''}>
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isOverLimit ? 'bg-destructive' : isNearLimit ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  isCurrent,
  isUpgrading,
  onUpgrade,
}: {
  plan: {
    id: PlanType
    name: string
    price: number
    features: string[]
    limits: { tokensPerMonth: number; apiCallsPerDay: number; channels: number; mcpServers: number }
  }
  isCurrent: boolean
  isUpgrading: boolean
  onUpgrade: (planId: PlanType) => void
}) {
  const isTeamPlan = plan.id === 'team'
  const isProPlan = plan.id === 'pro'

  return (
    <Card className={`relative ${isCurrent ? 'border-primary ring-2 ring-primary/20' : ''}`}>
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs rounded-full">
          Current Plan
        </div>
      )}
      {isProPlan && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-xs rounded-full">
          Popular
        </div>
      )}
      <CardHeader className="text-center pb-2">
        <CardTitle className="flex items-center justify-center gap-2">
          {plan.id === 'free' && <Zap className="h-5 w-5" />}
          {plan.id === 'pro' && <CreditCard className="h-5 w-5" />}
          {plan.id === 'team' && <Users className="h-5 w-5" />}
          {plan.name}
        </CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">${plan.price}</span>
          <span className="text-muted-foreground">/month</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
          <div>
            Tokens: {plan.limits.tokensPerMonth === -1 ? 'Unlimited' : `${(plan.limits.tokensPerMonth / 1000000).toFixed(1)}M/mo`}
          </div>
          <div>
            API Calls: {plan.limits.apiCallsPerDay === -1 ? 'Unlimited' : `${plan.limits.apiCallsPerDay.toLocaleString()}/day`}
          </div>
          <div>Channels: {plan.limits.channels === -1 ? 'Unlimited' : plan.limits.channels}</div>
          <div>MCP Servers: {plan.limits.mcpServers === -1 ? 'Unlimited' : plan.limits.mcpServers}</div>
        </div>
        <Button
          className="w-full"
          variant={isCurrent ? 'outline' : isTeamPlan ? 'default' : isProPlan ? 'default' : 'outline'}
          disabled={isCurrent || isUpgrading}
          onClick={() => onUpgrade(plan.id)}
        >
          {isUpgrading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : isCurrent ? (
            'Current Plan'
          ) : plan.price === 0 ? (
            'Downgrade'
          ) : (
            'Upgrade'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

export function Subscription() {
  const currentPlan = useSubscriptionStore(selectCurrentPlan)
  const currentPlanData = useSubscriptionStore(selectCurrentPlanData)
  const usage = useSubscriptionStore(selectUsage)
  const plans = useSubscriptionStore(selectPlans)
  const isLoading = useSubscriptionStore(selectIsLoading)
  const isUpgrading = useSubscriptionStore(selectIsUpgrading)

  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription)
  const upgradePlan = useSubscriptionStore((s) => s.upgradePlan)
  const refreshUsage = useSubscriptionStore((s) => s.refreshUsage)

  useEffect(() => {
    loadSubscription()
  }, [loadSubscription])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
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
                Current Plan: {currentPlanData?.name || 'Free'}
              </CardTitle>
              <CardDescription>
                {usage && (
                  <>
                    Billing period: {formatDate(usage.billingPeriodStart)} -{' '}
                    {formatDate(usage.billingPeriodEnd)}
                  </>
                )}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={refreshUsage}>
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
                label="Token Usage"
              />
              <UsageBar
                value={usage.apiCallsToday}
                max={usage.apiCallsLimit}
                label="API Calls Today"
              />
              <div className="flex gap-4 pt-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span className="text-muted-foreground">Normal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span className="text-muted-foreground">Near Limit (80%+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-destructive" />
                  <span className="text-muted-foreground">Over Limit</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
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
              Need more than Team plan offers? Contact us at{' '}
              <a href="mailto:sales@clawui.com" className="text-primary hover:underline">
                sales@clawui.com
              </a>{' '}
              for Enterprise pricing.
            </p>
            <p>
              All plans include a 14-day free trial. Cancel anytime. Prices are in USD.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Subscription
