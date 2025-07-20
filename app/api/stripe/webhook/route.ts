
import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe-server"
import { supabase } from "@/lib/supabase"
import type Stripe from "stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  console.log("Webhook received!")
  console.log("Webhook secret exists:", !!process.env.STRIPE_WEBHOOK_SECRET)
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!
    console.log("Signature exists:", !!signature)

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    console.log("Event type:", event.type)

    // Handle the event
    switch (event.type) {
      // THIS IS THE MISSING HANDLER!
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

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

// NEW FUNCTION: Handle checkout completion
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id)
  
  // Get customer and subscription info
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string
  const userEmail = session.customer_email
  const userId = session.client_reference_id || session.metadata?.user_id
  
  console.log('Session data:', { customerId, subscriptionId, userEmail, userId })
  
  // Try to find the user
  let userData;
  
  // First try by user ID (most reliable if user was logged in)
  if (userId) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single()
    userData = data
  }
  
  // If not found, try by email
  if (!userData && userEmail) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single()
    userData = data
  }
  
  // If still not found, try by customer ID
  if (!userData && customerId) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("stripe_customer_id", customerId)
      .single()
    userData = data
  }
  
  if (!userData) {
    console.error('User not found for checkout session:', session.id)
    // You might want to create a new user here or send an alert
    return
  }
  
  // Update user with subscription info
  const { error } = await supabase
    .from("users")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: 'active',
      subscription_tier: 'pro',
      usage_count: 0, // Reset usage for new pro users
    })
    .eq("id", userData.id)
    
  if (error) {
    console.error('Error updating user subscription:', error)
  } else {
    console.log('Successfully activated subscription for user:', userData.email)
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  // Find user by Stripe customer ID
  const { data: userData } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single()

  if (!userData) {
    console.error("User not found for customer:", customerId)
    return
  }

  // Update user subscription data (without period end)
  await supabase
    .from("users")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_tier: subscription.status === "active" ? "pro" : "free",
      subscription_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
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