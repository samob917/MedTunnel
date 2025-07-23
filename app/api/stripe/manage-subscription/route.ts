import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe-server"
import { createClient } from "@supabase/supabase-js"

// Use service role for database operations
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Use anon key for auth verification
const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(request: NextRequest) {
  console.log("=== MANAGE SUBSCRIPTION API START ===")

  try {
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
    }

    const body = await request.json()
    const authHeader = request.headers.get("authorization")
    const { userId, action } = body

    console.log("Request data:", { userId, action, hasAuth: !!authHeader })

    if (!userId || !action) {
      return NextResponse.json({ error: "User ID and action are required" }, { status: 400 })
    }

    if (!["cancel", "reactivate", "portal"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Verify authentication if auth header is provided
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "")
      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser(token)

      if (authError || !user || user.id !== userId) {
        console.error("Auth verification failed:", authError)
        return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
      }
      console.log("✅ Authentication verified for:", user.email)
    }

    // Get URL dynamically from request headers
    const host = request.headers.get("host")
    const protocol = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https")
    const baseUrl = `${protocol}://${host}`

    console.log("Base URL:", baseUrl)

    // Get user's Stripe customer ID and subscription ID using service role
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("stripe_customer_id, stripe_subscription_id, email")
      .eq("id", userId)
      .single()

    if (userError || !userData) {
      console.error("User not found:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("User data:", {
      email: userData.email,
      customerId: userData.stripe_customer_id,
      subscriptionId: userData.stripe_subscription_id,
    })

    if (!userData.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 })
    }

    // Handle different actions
    if (action === "cancel") {
      console.log("=== CANCELLING SUBSCRIPTION ===")

      if (!userData.stripe_subscription_id) {
        return NextResponse.json({ error: "No active subscription found" }, { status: 404 })
      }

      try {
        // Cancel subscription at period end in Stripe
        const updatedSubscription = await stripe.subscriptions.update(userData.stripe_subscription_id, {
          cancel_at_period_end: true,
        })

        console.log("✅ Subscription cancelled in Stripe:", {
          id: updatedSubscription.id,
          cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        })

        // Update database using service role
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            subscription_cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .select()
          .single()

        if (updateError) {
          console.error("Database update error:", updateError)
          return NextResponse.json({ error: "Failed to update subscription status in database" }, { status: 500 })
        }

        console.log("✅ Database updated successfully")

        return NextResponse.json({
          success: true,
          message: "Subscription will cancel at period end",
          subscription: {
            id: updatedSubscription.id,
            cancel_at_period_end: updatedSubscription.cancel_at_period_end,
          },
          user: updatedUser,
        })
      } catch (stripeError: any) {
        console.error("Stripe cancellation error:", stripeError)
        return NextResponse.json(
          {
            error: "Failed to cancel subscription in Stripe",
            details: stripeError.message,
          },
          { status: 500 },
        )
      }
    }

    if (action === "reactivate") {
      console.log("=== REACTIVATING SUBSCRIPTION ===")

      if (!userData.stripe_subscription_id) {
        return NextResponse.json({ error: "No subscription found" }, { status: 404 })
      }

      try {
        // Reactivate subscription in Stripe
        const updatedSubscription = await stripe.subscriptions.update(userData.stripe_subscription_id, {
          cancel_at_period_end: false,
        })

        console.log("✅ Subscription reactivated in Stripe:", {
          id: updatedSubscription.id,
          cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        })

        // Update database using service role
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            subscription_cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .select()
          .single()

        if (updateError) {
          console.error("Database update error:", updateError)
          return NextResponse.json({ error: "Failed to update subscription status in database" }, { status: 500 })
        }

        console.log("✅ Database updated successfully")

        return NextResponse.json({
          success: true,
          message: "Subscription reactivated",
          subscription: {
            id: updatedSubscription.id,
            cancel_at_period_end: updatedSubscription.cancel_at_period_end,
          },
          user: updatedUser,
        })
      } catch (stripeError: any) {
        console.error("Stripe reactivation error:", stripeError)
        return NextResponse.json(
          {
            error: "Failed to reactivate subscription in Stripe",
            details: stripeError.message,
          },
          { status: 500 },
        )
      }
    }

    if (action === "portal") {
      console.log("=== CREATING BILLING PORTAL SESSION ===")

      try {
        // Create customer portal session for billing management
        const session = await stripe.billingPortal.sessions.create({
          customer: userData.stripe_customer_id,
          return_url: baseUrl,
        })

        console.log("✅ Billing portal session created:", session.id)

        return NextResponse.json({
          success: true,
          url: session.url,
          message: "Billing portal session created",
        })
      } catch (stripeError: any) {
        console.error("Stripe portal error:", stripeError)
        return NextResponse.json(
          {
            error: "Failed to create billing portal session",
            details: stripeError.message,
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("=== MANAGE SUBSCRIPTION ERROR ===", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
