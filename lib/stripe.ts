// lib/stripe.ts - Client-safe version (can be imported anywhere)
import { loadStripe } from "@stripe/stripe-js"

// Client-side Stripe instance
let stripePromise: ReturnType<typeof loadStripe> | null = null

export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined")
      return null
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

// Client-safe configuration (no secret keys or server-only data)
export const STRIPE_CONFIG = {
  products: {
    pro: {
      name: "MedTunnel Pro",
      price: 200, // $2.00 in cents
      features: ["Unlimited conversions", "Priority support", "Advanced export options", "Configuration saving"],
    },
  },
}