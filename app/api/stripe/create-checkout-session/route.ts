import { type NextRequest, NextResponse } from "next/server"
import { stripe, STRIPE_CONFIG } from "@/lib/stripe-server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await request.json()

    if (!userId || !userEmail) {
      return NextResponse.json({ error: "User ID and email are required" }, { status: 400 })
    }

    // Get or create Stripe customer
    let customerId: string

    // Check if user already has a Stripe customer ID
    const { data: userData } = await supabase.from("users").select("stripe_customer_id").eq("id", userId).single()

    if (userData?.stripe_customer_id) {
      customerId = userData.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          supabase_user_id: userId,
        },
      })
      customerId = customer.id

      // Update user with Stripe customer ID
      await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", userId)
    }

    // Create checkout session
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?canceled=true`,
      metadata: {
        user_id: userId,
      },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}