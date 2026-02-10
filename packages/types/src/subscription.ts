// ============================================
// Subscription Types
// ============================================

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login result
 */
export interface LoginResult {
  success: boolean;
  error?: string;
  token?: string;
}

/**
 * Subscription plan type
 */
export type SubscriptionPlan = "free" | "pro" | "team";

/**
 * Subscription status
 */
export interface SubscriptionStatus {
  isLoggedIn: boolean;
  email?: string;
  plan?: SubscriptionPlan;
  expiresAt?: string;
  usage?: {
    messages: number;
    limit: number;
  };
}
