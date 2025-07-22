import { type NextRequest, NextResponse } from "next/server"
import { stripe, STRIPE_CONFIG } from "@/lib/stripe-server"
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
  console.log("=== CREATE CHECKOUT SESSION START ===")

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
      return NextResponse.json({ error: "Stripe configuration error" }, { status: 500 })
    }

    if (!process.env.STRIPE_PRO_PRICE_ID) {
      console.error("Missing STRIPE_PRO_PRICE_ID")
      return NextResponse.json({ error: "Stripe price configuration error" }, { status: 500 })
    }

    // Parse request body
    let body
    try {
      body = await request.json()
      console.log("Request body:", body)
    } catch (error) {
      console.error("Failed to parse request body:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { userId, userEmail } = body

    if (!userId || !userEmail) {
      console.error("Missing required fields:", { userId: !!userId, userEmail: !!userEmail })
      return NextResponse.json({ error: "User ID and email are required" }, { status: 400 })
    }

    // Get URL dynamically from request headers
    const host = request.headers.get("host")
    const protocol = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https")
    const baseUrl = `${protocol}://${host}`

    console.log("Base URL:", baseUrl)

    // Get or create Stripe customer with environment mismatch handling
    let customerId: string

    try {
      console.log("Looking up user:", userId)

      // Check if user already has a Stripe customer ID using service role
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("stripe_customer_id")
        .eq("id", userId)
        .single()

      if (userError) {
        console.error("Supabase user query error:", {
          message: userError.message,
          code: userError.code,
          details: userError.details,
          hint: userError.hint,
        })

        // Check if user doesn't exist
        if (userError.code === "PGRST116") {
          return NextResponse.json(
            {
              error: "User not found",
              details: "Please sign in again",
            },
            { status: 404 },
          )
        }

        return NextResponse.json(
          {
            error: "Database error",
            details: userError.message,
          },
          { status: 500 },
        )
      }

      console.log("User data:", userData)

      if (userData?.stripe_customer_id) {
        // Try to verify the customer exists in the current Stripe environment
        try {
          const existingCustomer = await stripe.customers.retrieve(userData.stripe_customer_id)
          if (existingCustomer && !existingCustomer.deleted) {
            customerId = userData.stripe_customer_id
            console.log("Using existing customer:", customerId)
          } else {
            throw new Error("Customer not found or deleted")
          }
        } catch (stripeError: any) {
          console.log("Existing customer not found in current environment:", stripeError.message)
          console.log("Creating new customer for current environment...")

          // Create new customer and update database
          const customer = await stripe.customers.create({
            email: userEmail,
            metadata: {
              supabase_user_id: userId,
              migrated_from: userData.stripe_customer_id, // Keep track of old ID
            },
          })
          customerId = customer.id
          console.log("Created new customer:", customerId)

          // Update user with new Stripe customer ID
          const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({
              stripe_customer_id: customerId,
              // Clear old subscription data since it's from test environment
              stripe_subscription_id: null,
              subscription_status: null,
              subscription_tier: "free",
            })
            .eq("id", userId)

          if (updateError) {
            console.error("Failed to update user with new customer ID:", updateError)
            // Continue anyway, we have the customer created
          } else {
            console.log("Updated user with new customer ID")
          }
        }
      } else {
        // Create new Stripe customer
        console.log("Creating new Stripe customer for:", userEmail)
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            supabase_user_id: userId,
          },
        })
        customerId = customer.id
        console.log("Created new customer:", customerId)

        // Update user with Stripe customer ID using service role
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId)

        if (updateError) {
          console.error("Failed to update user with customer ID:", updateError)
          // Continue anyway, we have the customer created
        } else {
          console.log("Updated user with customer ID")
        }
      }
    } catch (error) {
      console.error("Error handling customer:", error)
      return NextResponse.json({ error: "Customer creation failed" }, { status: 500 })
    }

    // Create checkout session
    try {
      console.log("Creating checkout session with:", {
        customerId,
        priceId: STRIPE_CONFIG.products.pro.priceId,
        successUrl: `${baseUrl}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/?canceled=true`,
      })

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: STRIPE_CONFIG.products.pro.priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${baseUrl}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/?canceled=true`,
        client_reference_id: userId,
        metadata: {
          user_id: userId,
        },
        allow_promotion_codes: true,
        billing_address_collection: "auto",
      })

      console.log("Checkout session created:", session.id)
      return NextResponse.json({ sessionId: session.id })
    } catch (stripeError) {
      console.error("Stripe checkout session creation failed:", stripeError)
      return NextResponse.json(
        {
          error: "Failed to create checkout session",
          details: stripeError instanceof Error ? stripeError.message : "Unknown error",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("=== CREATE CHECKOUT SESSION ERROR ===", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
