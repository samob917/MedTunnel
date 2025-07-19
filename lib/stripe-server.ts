
// lib/stripe-server.ts - Server-only version (import ONLY in API routes)
import Stripe from "stripe"

// This file should ONLY be imported in server-side code (API routes)
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is not set in environment variables")
  throw new Error("STRIPE_SECRET_KEY is required for Stripe initialization")
}

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-06-30.basil",
})

// Server configuration with price ID (includes secret data)
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

// Re-export the stripe instance for backward compatibility
export default stripe