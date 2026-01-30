import Stripe from "stripe";
import type { Request, Response } from "express";
import * as db from "../db";
import { getPlanByPriceId, isYearlyPrice } from "./products";

// Only initialize Stripe if API key is configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!stripe) {
    console.warn("[Stripe Webhook] Stripe is not configured");
    return res.status(503).send("Stripe not configured");
  }

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("[Stripe Webhook] No signature found");
    return res.status(400).send("No signature");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log("[Stripe Webhook] Processing checkout.session.completed");

  const organizationId = session.metadata?.organization_id;
  const userId = session.metadata?.user_id;
  const customerId = session.customer as string;

  if (!organizationId) {
    console.error("[Stripe Webhook] No organization_id in session metadata");
    return;
  }

  const orgId = parseInt(organizationId, 10);

  // Update organization with Stripe customer ID
  await db.updateOrganization(orgId, {
    stripeCustomerId: customerId,
  });

  // Create payment record
  await db.createPayment({
    organizationId: orgId,
    amount: session.amount_total || 0,
    currency: session.currency || "jpy",
    paymentMethod: "stripe",
    paymentStatus: "completed",
    stripePaymentIntentId: session.payment_intent as string,
    description: `Checkout session: ${session.id}`,
  });

  // Create audit log
  await db.createAuditLog({
    userId: userId || "system",
    action: "payment_completed",
    objectType: "organization",
    objectId: organizationId,
    payload: JSON.stringify({
      sessionId: session.id,
      amount: session.amount_total,
      currency: session.currency,
    }),
  });

  console.log(`[Stripe Webhook] Checkout completed for organization ${organizationId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log("[Stripe Webhook] Processing subscription update");

  const customerId = subscription.customer as string;

  // Find organization by Stripe customer ID
  const dbInstance = await db.getDb();
  if (!dbInstance) return;

  const { organizations } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const orgs = await dbInstance
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);

  if (orgs.length === 0) {
    console.error(`[Stripe Webhook] No organization found for customer ${customerId}`);
    return;
  }

  const org = orgs[0];

  // Determine subscription status
  let status: "trial" | "active" | "cancelled" | "expired" = "active";
  if (subscription.status === "trialing") {
    status = "trial";
  } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
    status = "cancelled";
  } else if (subscription.status === "past_due") {
    status = "expired";
  }

  // Determine plan from price ID
  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanByPriceId(priceId) || "starter";

  // Calculate expiration date
  const expiresAt = new Date(subscription.current_period_end * 1000);

  // Update organization subscription
  await db.updateOrganizationSubscription(org.id, status, plan, expiresAt);

  // Update Stripe subscription ID
  await db.updateOrganization(org.id, {
    stripeSubscriptionId: subscription.id,
  });

  console.log(`[Stripe Webhook] Subscription updated for organization ${org.id}: ${status} (${plan})`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("[Stripe Webhook] Processing subscription deletion");

  const customerId = subscription.customer as string;

  // Find organization by Stripe customer ID
  const dbInstance = await db.getDb();
  if (!dbInstance) return;

  const { organizations } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const orgs = await dbInstance
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);

  if (orgs.length === 0) {
    console.error(`[Stripe Webhook] No organization found for customer ${customerId}`);
    return;
  }

  const org = orgs[0];

  // Mark subscription as cancelled
  await db.updateOrganizationSubscription(org.id, "cancelled", "free", undefined);

  console.log(`[Stripe Webhook] Subscription cancelled for organization ${org.id}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log("[Stripe Webhook] Processing invoice.paid");

  const customerId = invoice.customer as string;

  // Find organization by Stripe customer ID
  const dbInstance = await db.getDb();
  if (!dbInstance) return;

  const { organizations } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const orgs = await dbInstance
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);

  if (orgs.length === 0) {
    console.error(`[Stripe Webhook] No organization found for customer ${customerId}`);
    return;
  }

  const org = orgs[0];

  // Create payment record
  await db.createPayment({
    organizationId: org.id,
    amount: invoice.amount_paid || 0,
    currency: invoice.currency || "jpy",
    paymentMethod: "stripe",
    paymentStatus: "completed",
    stripePaymentIntentId: invoice.payment_intent as string,
    description: `Invoice: ${invoice.id}`,
  });

  console.log(`[Stripe Webhook] Invoice paid for organization ${org.id}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("[Stripe Webhook] Processing invoice.payment_failed");

  const customerId = invoice.customer as string;

  // Find organization by Stripe customer ID
  const dbInstance = await db.getDb();
  if (!dbInstance) return;

  const { organizations } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const orgs = await dbInstance
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);

  if (orgs.length === 0) {
    console.error(`[Stripe Webhook] No organization found for customer ${customerId}`);
    return;
  }

  const org = orgs[0];

  // Create failed payment record
  await db.createPayment({
    organizationId: org.id,
    amount: invoice.amount_due || 0,
    currency: invoice.currency || "jpy",
    paymentMethod: "stripe",
    paymentStatus: "failed",
    stripePaymentIntentId: invoice.payment_intent as string,
    description: `Failed invoice: ${invoice.id}`,
  });

  // Create audit log
  await db.createAuditLog({
    userId: "system",
    action: "payment_failed",
    objectType: "organization",
    objectId: org.id.toString(),
    payload: JSON.stringify({
      invoiceId: invoice.id,
      amount: invoice.amount_due,
    }),
  });

  console.log(`[Stripe Webhook] Invoice payment failed for organization ${org.id}`);
}
