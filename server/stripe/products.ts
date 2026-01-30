/**
 * Stripe Products Configuration
 * Maps Stripe price IDs to plan information
 */

export type Plan = {
  id: string;
  name: string;
  priceId: string;
  yearlyPriceId?: string;
  features: string[];
};

// Define your plans here
// Update these price IDs with your actual Stripe price IDs
const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceId: "",
    features: ["Basic features"],
  },
  {
    id: "pro",
    name: "Pro",
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
    yearlyPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
    features: ["All features", "Priority support"],
  },
];

/**
 * Get plan by Stripe price ID
 */
export function getPlanByPriceId(priceId: string): Plan | undefined {
  return plans.find(
    (plan) => plan.priceId === priceId || plan.yearlyPriceId === priceId
  );
}

/**
 * Check if a price ID is for yearly billing
 */
export function isYearlyPrice(priceId: string): boolean {
  return plans.some((plan) => plan.yearlyPriceId === priceId);
}

/**
 * Get all available plans
 */
export function getAllPlans(): Plan[] {
  return plans;
}
