"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Crown, CreditCard, X, Check, AlertCircle } from "lucide-react"
import { useAuth } from "./auth-provider"
import { getStripe } from "@/lib/stripe"

interface SubscriptionManagerProps {
  onClose?: () => void
}

export function SubscriptionManager({ onClose }: SubscriptionManagerProps) {
  const { user, usageCount, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isProUser = user?.subscription_tier === "pro" && user?.subscription_status === "active"
  const isCanceling = user?.subscription_cancel_at_period_end

  // Check for successful payment on component mount
  useEffect(() => {
    console.log("=== SUBSCRIPTION MANAGER MOUNTED ===")

    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get("success")
    const sessionId = urlParams.get("session_id")

    console.log("URL params:", {
      success,
      sessionId,
      fullUrl: window.location.href,
      search: window.location.search,
    })

    if (success === "true" && sessionId) {
      console.log("✅ Payment success detected! Session ID:", sessionId)
      checkAndUpdateSession(sessionId)
    } else if (success === "true") {
      console.log("⚠️ Success=true but no session_id found")
    } else {
      console.log("ℹ️ No payment success detected in URL")
    }
  }, [])

  const checkAndUpdateSession = async (sessionId: string) => {
    console.log("=== CHECKING SESSION START ===")
    console.log("Session ID:", sessionId)

    try {
      setActionLoading("checking")
      console.log("Making API call to /api/stripe/check-session...")

      const response = await fetch("/api/stripe/check-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      console.log("API Response status:", response.status)
      console.log("API Response ok:", response.ok)

      const data = await response.json()
      console.log("API Response data:", data)

      if (data.success) {
        console.log("✅ Session check successful!")
        setSuccess("✅ Payment successful! Your subscription has been activated.")
        await refreshUser()
        console.log("✅ User data refreshed")
      } else {
        console.log("⚠️ Session not yet processed, refreshing user data anyway")
        await refreshUser()
      }
    } catch (error) {
      console.error("❌ Session check error:", error)
    } finally {
      setActionLoading(null)
      console.log("=== CHECKING SESSION END ===")
    }
  }

  const handleUpgrade = async () => {
    if (!user) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log("Starting checkout process for user:", user.id)

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
        }),
      })

      console.log("Checkout response status:", response.status)

      if (!response.ok) {
        const errorData = await response.text()
        console.error("Checkout session creation failed:", errorData)
        throw new Error(`Failed to create checkout session: ${response.status}`)
      }

      const data = await response.json()
      console.log("Checkout session data:", data)

      if (!data.sessionId) {
        throw new Error("No session ID returned from server")
      }

      const stripe = await getStripe()
      if (!stripe) {
        throw new Error("Failed to load Stripe")
      }

      console.log("Redirecting to Stripe checkout...")
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (stripeError) {
        console.error("Stripe checkout error:", stripeError)
        throw new Error(stripeError.message || "Stripe checkout failed")
      }
    } catch (error) {
      console.error("Error creating checkout session:", error)
      setError(error instanceof Error ? error.message : "Failed to start checkout")
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async (action: "cancel" | "reactivate" | "portal") => {
    if (!user) return

    setActionLoading(action)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/stripe/manage-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          action,
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error("Subscription management failed:", errorData)
        throw new Error(`Failed to ${action} subscription`)
      }

      const result = await response.json()

      if (action === "portal" && result.url) {
        window.open(result.url, "_blank")
      } else {
        // Refresh user data to get updated subscription status
        await refreshUser()
        setSuccess(`✅ Subscription ${action}ed successfully!`)
      }
    } catch (error) {
      console.error("Error managing subscription:", error)
      setError(error instanceof Error ? error.message : `Failed to ${action} subscription`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Success Alert */}
      {success && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isProUser ? (
                  <>
                    <Crown className="w-5 h-5 text-yellow-500" />
                    MedTunnel Pro
                  </>
                ) : (
                  "MedTunnel Free"
                )}
                {actionLoading === "checking" && <Loader2 className="w-4 h-4 animate-spin" />}
              </CardTitle>
              <CardDescription>
                {isProUser ? "Unlimited conversions and premium features" : "Limited to 5 conversions"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isProUser ? "default" : "secondary"}>{isProUser ? "Pro" : "Free"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Usage Stats */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Usage this period</span>
              <span className="text-sm">
                {usageCount} / {isProUser ? "Unlimited" : "5"} conversions
              </span>
            </div>

            {/* Subscription Details - REMOVED period end display */}
            {isProUser && (
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>Status:</strong> {isCanceling ? "Will cancel at next billing cycle" : "Active subscription"}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isProUser ? (
                <Button onClick={handleUpgrade} disabled={loading} className="flex-1">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Upgrade to Pro - $2/month
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleManageSubscription("portal")}
                    disabled={actionLoading === "portal"}
                    className="flex-1"
                  >
                    {actionLoading === "portal" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Billing
                  </Button>

                  {!isCanceling ? (
                    <Button
                      variant="outline"
                      onClick={() => handleManageSubscription("cancel")}
                      disabled={actionLoading === "cancel"}
                    >
                      {actionLoading === "cancel" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleManageSubscription("reactivate")}
                      disabled={actionLoading === "reactivate"}
                    >
                      {actionLoading === "reactivate" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Check className="w-4 h-4 mr-2" />
                      Reactivate
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Free Plan</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 5 conversions per month</li>
                <li>• Basic export formats</li>
                <li>• Community support</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-1">
                <Crown className="w-4 h-4 text-yellow-500" />
                Pro Plan - $2/month
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Unlimited conversions</li>
                <li>• Advanced export options</li>
                <li>• Configuration saving</li>
                <li>• Priority support</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {onClose && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
