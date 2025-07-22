import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe-server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(request: NextRequest) {
  console.log("=== CHECK SESSION API ROUTE START ===")

  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL")
      return NextResponse.json({ error: "Supabase URL not configured" }, { status: 500 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY")
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("Missing STRIPE_SECRET_KEY")
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
    }

    const { sessionId } = await request.json()
    console.log("Received session ID:", sessionId)

    if (!sessionId) {
      console.error("No session ID provided")
      return NextResponse.json({ error: "Session ID required" }, { status: 400 })
    }

    console.log("Retrieving session from Stripe...")

    // Get the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    console.log("Session retrieved:", {
      id: session.id,
      payment_status: session.payment_status,
      customer: session.customer,
      subscription: session.subscription,
      client_reference_id: session.client_reference_id,
    })

    if (session.payment_status === "paid" && session.subscription) {
      console.log("Payment confirmed, getting subscription details...")

      // Get subscription details
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      console.log("Subscription details:", {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
      })

      const userId = session.client_reference_id
      if (userId) {
        console.log("Updating user in database:", userId)

        // Update the user in the database - REMOVED current_period_end
        const { data, error } = await supabaseAdmin
          .from("users")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            subscription_tier: subscription.status === "active" ? "pro" : "free",
            usage_count: 0,
            subscription_cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .select()

        if (error) {
          console.error("Database update error:", error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log("✅ User updated successfully:", data[0])

        return NextResponse.json({
          success: true,
          message: "Subscription activated",
          session: {
            id: session.id,
            payment_status: session.payment_status,
            subscription_status: subscription.status,
          },
          user: data[0],
        })
      } else {
        console.error("No user ID found in session")
        return NextResponse.json({ error: "No user ID found in session" }, { status: 400 })
      }
    }

    console.log("Payment not yet completed or no subscription found")
    return NextResponse.json({
      success: false,
      message: "Payment not yet completed",
      session: {
        id: session.id,
        payment_status: session.payment_status,
        subscription: session.subscription,
      },
    })
  } catch (error) {
    console.error("=== CHECK SESSION ERROR ===", error)
    return NextResponse.json(
      {
        error: "Failed to check session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
