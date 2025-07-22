import { NextResponse } from "next/server"

export async function GET() {
  console.log("=== TESTING STRIPE ROUTES ===")

  return NextResponse.json({
    message: "Stripe API routes are accessible",
    timestamp: new Date().toISOString(),
    routes: {
      "check-session": "/api/stripe/check-session",
      "create-checkout-session": "/api/stripe/create-checkout-session",
      "manage-subscription": "/api/stripe/manage-subscription",
    },
    environment: {
      hasStripeSecret: !!process.env.STRIPE_SECRET_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  })
}
