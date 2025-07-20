import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe-server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { userId, action } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get URL dynamically from request headers
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`

    // Get user's Stripe customer ID
    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", userId)
      .single()

    if (!userData?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 })
    }

    if (action === "cancel") {
      if (!userData.stripe_subscription_id) {
        return NextResponse.json({ error: "No active subscription found" }, { status: 404 })
      }

      // Cancel subscription at period end
      await stripe.subscriptions.update(userData.stripe_subscription_id, {
        cancel_at_period_end: true,
      })

      // Update database
      await supabase.from("users").update({ subscription_cancel_at_period_end: true }).eq("id", userId)

      return NextResponse.json({ success: true, message: "Subscription will cancel at period end" })
    }

    if (action === "reactivate") {
      if (!userData.stripe_subscription_id) {
        return NextResponse.json({ error: "No subscription found" }, { status: 404 })
      }

      // Reactivate subscription
      await stripe.subscriptions.update(userData.stripe_subscription_id, {
        cancel_at_period_end: false,
      })

      // Update database
      await supabase.from("users").update({ subscription_cancel_at_period_end: false }).eq("id", userId)

      return NextResponse.json({ success: true, message: "Subscription reactivated" })
    }

    // Create customer portal session for other management tasks
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: baseUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Error managing subscription:", error)
    return NextResponse.json({ error: "Failed to manage subscription" }, { status: 500 })
  }
}