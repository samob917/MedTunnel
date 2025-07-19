import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe-server"
import { supabase } from "@/lib/supabase"
import type Stripe from "stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  console.log("SUBSCRIPTION", subscription)

  // Find user by Stripe customer ID
  const { data: userData } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single()

  if (!userData) {
    console.error("User not found for customer:", customerId)
    return
  }

  // Update user subscription data
  await supabase
    .from("users")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_tier: subscription.status === "active" ? "pro" : "free",
      //subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
      // Reset usage count when subscription becomes active
      usage_count: subscription.status === "active" ? 0 : undefined,
    })
    .eq("id", userData.id)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const { data: userData } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single()

  if (!userData) {
    console.error("User not found for customer:", customerId)
    return
  }

  // Update user to free tier
  await supabase
    .from("users")
    .update({
      subscription_status: "canceled",
      subscription_tier: "free",
      stripe_subscription_id: null,
      subscription_current_period_end: null,
      subscription_cancel_at_period_end: false,
      usage_count: 0, // Reset usage count
    })
    .eq("id", userData.id)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Reset usage count on successful payment
  const customerId = invoice.customer as string

  const { data: userData } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single()

  if (userData) {
    await supabase.from("users").update({ usage_count: 0 }).eq("id", userData.id)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Handle failed payment - could send notification, etc.
  console.log("Payment failed for invoice:", invoice.id)
}
