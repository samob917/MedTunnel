import Stripe from "stripe"
import { loadStripe } from "@stripe/stripe-js"

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
})

// Client-side Stripe instance
export const getStripe = () => {
  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
}

// Product and price configuration
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
