"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Crown, X, Check, AlertCircle } from "lucide-react"
import { useAuth } from "./auth-provider"
import { getStripe } from "@/lib/stripe"
import { supabase } from "@/lib/supabase"

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
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get("success")
    const sessionId = urlParams.get("session_id")

    if (success === "true" && sessionId) {
      checkAndUpdateSession(sessionId)
    }
  }, [])

  const checkAndUpdateSession = async (sessionId: string) => {
    try {
      setActionLoading("checking")

      const response = await fetch("/api/stripe/check-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess("✅ Payment successful! Your subscription has been activated.")
        await refreshUser()
      } else {
        await refreshUser()
      }
    } catch (error) {
      // Silent error handling for better UX
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpgrade = async () => {
    if (!user) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
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

      if (!response.ok) {
        throw new Error(`Failed to create checkout session: ${response.status}`)
      }

      const data = await response.json()

      if (!data.sessionId) {
        throw new Error("No session ID returned from server")
      }

      const stripe = await getStripe()
      if (!stripe) {
        throw new Error("Failed to load Stripe")
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      })

      if (stripeError) {
        throw new Error(stripeError.message || "Stripe checkout failed")
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to start checkout")
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async (action: "cancel" | "reactivate") => {
    if (!user) return

    setActionLoading(action)
    setError(null)
    setSuccess(null)

    try {
      // Get auth token with timeout
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      try {
        const sessionTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Session timeout")), 3000)
        })

        const sessionPromise = supabase.auth.getSession()
        const {
          data: { session },
        } = (await Promise.race([sessionPromise, sessionTimeoutPromise])) as any

        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`
        }
      } catch (sessionError) {
        // Continue without auth header - API should still work
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch("/api/stripe/manage-subscription", {
          method: "POST",
          headers,
          body: JSON.stringify({
            userId: user.id,
            action,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()

          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: `Server error (${response.status})` }
          }

          throw new Error(errorData.error || `Failed to ${action} subscription`)
        }

        const result = await response.json()

        if (action === "cancel") {
          try {
            await refreshUser()
          } catch (refreshError) {
            // Silent error handling
          }

          setSuccess(
            "✅ Subscription cancelled successfully! It will remain active until the end of your billing period.",
          )
        } else if (action === "reactivate") {
          try {
            await refreshUser()
          } catch (refreshError) {
            // Silent error handling
          }

          setSuccess("✅ Subscription reactivated successfully!")
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          throw new Error(`${action} request timed out after 10 seconds`)
        }
        throw fetchError
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("timeout")) {
        setError(
          `Operation timed out. ${action === "cancel" ? "Your cancellation may have been processed - please refresh the page to check." : "Please try again."}`,
        )
      } else {
        setError(error instanceof Error ? error.message : `Failed to ${action} subscription`)
      }
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
              {isCanceling && (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  Cancelling
                </Badge>
              )}
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

            {/* Subscription Details */}
            {isProUser && (
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>Status:</strong>{" "}
                  {isCanceling
                    ? "Will cancel at next billing cycle"
                    : user?.subscription_status === "active"
                      ? "Active subscription"
                      : `Subscription ${user?.subscription_status || "unknown"}`}
                </p>
                {isCanceling && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 text-sm">
                      <strong>⚠️ Cancellation Scheduled:</strong> Your subscription will remain active with full access
                      until your next billing date. You can reactivate anytime before then.
                    </p>
                  </div>
                )}
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
                  {!isCanceling ? (
                    <Button
                      variant="outline"
                      onClick={() => handleManageSubscription("cancel")}
                      disabled={actionLoading === "cancel"}
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {actionLoading === "cancel" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <X className="w-4 h-4 mr-2" />
                      Cancel Subscription
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleManageSubscription("reactivate")}
                      disabled={actionLoading === "reactivate"}
                      className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      {actionLoading === "reactivate" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Check className="w-4 h-4 mr-2" />
                      Reactivate Subscription
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Billing Note - Removed billing portal, added support contact */}
            {isProUser && (
              <div className="text-xs text-gray-500 text-center">
                For billing questions or to update payment methods, please contact support.
              </div>
            )}
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
