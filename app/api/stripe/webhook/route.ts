import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe-server"
import { createClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

// Use service role for database operations
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  console.log("=== WEBHOOK RECEIVED ===")
  console.log("Timestamp:", new Date().toISOString())
  console.log("Webhook secret exists:", !!process.env.STRIPE_WEBHOOK_SECRET)
  console.log("Headers:", Object.fromEntries(request.headers.entries()))

  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    console.log("Body length:", body.length)
    console.log("Signature exists:", !!signature)

    if (!signature) {
      console.error("❌ No Stripe signature found")
      return NextResponse.json({ error: "No signature" }, { status: 400 })
    }

    if (!webhookSecret) {
      console.error("❌ STRIPE_WEBHOOK_SECRET not configured")
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log("✅ Event verified:", event.type, "ID:", event.id)
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Handle the event
    console.log("🔄 Processing event:", event.type)

    switch (event.type) {
      case "checkout.session.completed":
        console.log("💳 Processing checkout session completed")
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case "customer.subscription.created":
        console.log("📝 Processing subscription created")
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.updated":
        console.log("🔄 Processing subscription updated")
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.deleted":
        console.log("❌ Processing subscription deleted")
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case "invoice.payment_succeeded":
        console.log("💰 Processing payment succeeded")
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case "invoice.payment_failed":
        console.log("💸 Processing payment failed")
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`)
    }

    console.log("✅ Webhook processed successfully")
    return NextResponse.json({ received: true, eventType: event.type, eventId: event.id })
  } catch (error) {
    console.error("=== WEBHOOK ERROR ===", error)
    return NextResponse.json(
      {
        error: "Webhook handler failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log("=== CHECKOUT SESSION COMPLETED ===")
  console.log("Session ID:", session.id)
  console.log("Payment status:", session.payment_status)

  try {
    // Get customer and subscription info
    const customerId = session.customer as string
    const subscriptionId = session.subscription as string
    const userEmail = session.customer_email
    const userId = session.client_reference_id || session.metadata?.user_id

    console.log("Session data:", {
      customerId,
      subscriptionId,
      userEmail,
      userId,
      paymentStatus: session.payment_status,
    })

    if (!userId) {
      console.error("❌ No user ID found in session")
      return
    }

    if (session.payment_status !== "paid") {
      console.log("⏳ Payment not yet completed, status:", session.payment_status)
      return
    }

    // Get subscription details from Stripe
    let subscriptionData = null
    if (subscriptionId) {
      try {
        subscriptionData = await stripe.subscriptions.retrieve(subscriptionId)
        console.log("📋 Subscription details:", {
          id: subscriptionData.id,
          status: subscriptionData.status,
          cancel_at_period_end: subscriptionData.cancel_at_period_end,
        })
      } catch (subError) {
        console.error("❌ Error fetching subscription:", subError)
      }
    }

    // Update user with subscription info using service role - REMOVED current_period_end
    const updateData = {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: subscriptionData?.status || "active",
      subscription_tier: "pro",
      usage_count: 0, // Reset usage for new pro users
      subscription_cancel_at_period_end: subscriptionData?.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    }

    console.log("🔄 Updating user with data:", updateData)

    const { data, error } = await supabaseAdmin.from("users").update(updateData).eq("id", userId).select()

    if (error) {
      console.error("❌ Error updating user subscription:", error)
      throw error
    } else {
      console.log("✅ Successfully activated subscription for user:", userId)
      console.log("📊 Updated user data:", data[0])
    }
  } catch (error) {
    console.error("❌ Error in handleCheckoutSessionCompleted:", error)
    throw error
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log("=== SUBSCRIPTION UPDATE ===")
  console.log("Subscription ID:", subscription.id)
  console.log("Status:", subscription.status)

  const customerId = subscription.customer as string

  try {
    // Find user by Stripe customer ID using service role
    const { data: userData, error: findError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("stripe_customer_id", customerId)
      .single()

    if (findError || !userData) {
      console.error("❌ User not found for customer:", customerId, findError)
      return
    }

    console.log("👤 Found user:", userData.email)

    // Update user subscription data using service role - REMOVED current_period_end
    const updateData = {
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_tier: subscription.status === "active" ? "pro" : "free",
      subscription_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      usage_count: subscription.status === "active" ? 0 : undefined,
      updated_at: new Date().toISOString(),
    }

    console.log("🔄 Updating subscription with:", updateData)

    const { data, error } = await supabaseAdmin.from("users").update(updateData).eq("id", userData.id).select()

    if (error) {
      console.error("❌ Error updating subscription:", error)
      throw error
    }

    console.log("✅ Subscription updated for user:", userData.id)
    console.log("📊 Updated data:", data[0])
  } catch (error) {
    console.error("❌ Error in handleSubscriptionUpdate:", error)
    throw error
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("=== SUBSCRIPTION DELETED ===")
  const customerId = subscription.customer as string

  try {
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("stripe_customer_id", customerId)
      .single()

    if (!userData) {
      console.error("❌ User not found for customer:", customerId)
      return
    }

    console.log("👤 Found user for deletion:", userData.email)

    // Update user to free tier using service role
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({
        subscription_status: "canceled",
        subscription_tier: "free",
        stripe_subscription_id: null,
        subscription_cancel_at_period_end: false,
        usage_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userData.id)
      .select()

    if (error) {
      console.error("❌ Error deleting subscription:", error)
      throw error
    }

    console.log("✅ Subscription deleted for user:", userData.id)
  } catch (error) {
    console.error("❌ Error in handleSubscriptionDeleted:", error)
    throw error
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("=== PAYMENT SUCCEEDED ===")
  const customerId = invoice.customer as string

  try {
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("stripe_customer_id", customerId)
      .single()

    if (userData) {
      await supabaseAdmin
        .from("users")
        .update({
          usage_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userData.id)

      console.log("✅ Usage reset for user:", userData.email)
    }
  } catch (error) {
    console.error("❌ Error in handlePaymentSucceeded:", error)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log("=== PAYMENT FAILED ===")
  console.log("Payment failed for invoice:", invoice.id)
  console.log("Customer:", invoice.customer)
  console.log("Amount:", invoice.amount_due)
}
