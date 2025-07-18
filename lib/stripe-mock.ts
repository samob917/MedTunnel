// Mock Stripe configuration for development without API keys
export const stripe = null // Mock for server-side

// Mock client-side Stripe instance
export const getStripe = () => {
  return Promise.resolve({
    redirectToCheckout: async ({ sessionId }: { sessionId: string }) => {
      // Mock redirect - just show an alert for demo
      alert(`Mock Stripe Checkout: Would redirect to session ${sessionId}`)
      return { error: null }
    }
  })
}

// Product and price configuration (same as real version)
export const STRIPE_CONFIG = {
  products: {
    pro: {
      priceId: "price_mock_2_dollars_monthly",
      name: "MedTunnel Pro",
      price: 200, // $2.00 in cents
      features: ["Unlimited conversions", "Priority support", "Advanced export options", "Configuration saving"],
    },
  },
}
