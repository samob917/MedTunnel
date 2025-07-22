import Stripe from "stripe"

// Validate environment variables
const requiredEnvVars = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
}

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key)

if (missingVars.length > 0) {
  console.error("Missing required Stripe environment variables:", missingVars)
  throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`)
}

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
  typescript: true,
})

// Server configuration with price ID
export const STRIPE_CONFIG = {
  products: {
    pro: {
      priceId: process.env.STRIPE_PRO_PRICE_ID!,
      name: "MedTunnel Pro",
      price: 200, // $2.00 in cents
      features: ["Unlimited conversions", "Priority support", "Advanced export options", "Configuration saving"],
    },
  },
}

export default stripe
