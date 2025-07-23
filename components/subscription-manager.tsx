"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Crown, CreditCard, X, Check, AlertCircle, ExternalLink } from "lucide-react"
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
      console.log(`=== ${action.toUpperCase()} SUBSCRIPTION START ===`)

      // Add timeout for the entire operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${action} operation timed out after 15 seconds`)), 15000)
      })

      const operationPromise = async () => {
        // Get auth token with timeout
        console.log("Getting auth session...")

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        }

        try {
          // Add timeout for session call
          const sessionTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Session timeout")), 3000)
          })

          const sessionPromise = supabase.auth.getSession()
          const {
            data: { session },
          } = (await Promise.race([sessionPromise, sessionTimeoutPromise])) as any

          if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`
            console.log("✅ Auth token obtained")
          } else {
            console.log("⚠️ No auth token, proceeding without auth header")
          }
        } catch (sessionError) {
          console.log("⚠️ Session call failed, proceeding without auth:", sessionError)
          // Continue without auth header - API should still work
        }

        console.log("Making API call to /api/stripe/manage-subscription...")

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
          console.log(`${action} response status:`, response.status)

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`${action} failed:`, response.status, errorText)

            let errorMessage
            try {
              const parsedError = JSON.parse(errorText)
              errorMessage = parsedError.error || `Failed to ${action} subscription`
            } catch {
              errorMessage = `Server error (${response.status}): ${errorText.substring(0, 100)}`
            }

            throw new Error(errorMessage)
          }

          const result = await response.json()
          console.log(`${action} result:`, result)

          if (action === "portal" && result.url) {
            window.open(result.url, "_blank")
            setSuccess("✅ Billing portal opened in new tab")
          } else if (action === "cancel") {
            console.log("🔄 Refreshing user data after cancellation...")

            // Try to refresh user data with timeout
            try {
              const refreshPromise = refreshUser()
              const refreshTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("User refresh timeout")), 5000)
              })

              await Promise.race([refreshPromise, refreshTimeout])
              console.log("✅ User data refreshed successfully")
            } catch (refreshError) {
              console.log("⚠️ User refresh failed, but cancellation was successful:", refreshError)
            }

            setSuccess(
              "✅ Subscription cancelled successfully! It will remain active until the end of your billing period.",
            )
          } else if (action === "reactivate") {
            console.log("🔄 Refreshing user data after reactivation...")

            try {
              const refreshPromise = refreshUser()
              const refreshTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("User refresh timeout")), 5000)
              })

              await Promise.race([refreshPromise, refreshTimeout])
              console.log("✅ User data refreshed successfully")
            } catch (refreshError) {
              console.log("⚠️ User refresh failed, but reactivation was successful:", refreshError)
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
      }

      // Race the operation against the timeout
      await Promise.race([operationPromise(), timeoutPromise])
    } catch (error) {
      console.error(`=== ${action.toUpperCase()} SUBSCRIPTION ERROR ===`)
      console.error("Error:", error)

      if (error instanceof Error && error.message.includes("timeout")) {
        setError(
          `Operation timed out. ${action === "cancel" ? "Your cancellation may have been processed - please refresh the page to check." : "Please try again."}`,
        )
      } else {
        setError(error instanceof Error ? error.message : `Failed to ${action} subscription`)
      }
    } finally {
      setActionLoading(null)
      console.log(`=== ${action.toUpperCase()} SUBSCRIPTION END ===`)
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
                  <Button
                    variant="outline"
                    onClick={() => handleManageSubscription("portal")}
                    disabled={actionLoading === "portal"}
                    className="flex-1"
                  >
                    {actionLoading === "portal" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Billing
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>

                  {!isCanceling ? (
                    <Button
                      variant="outline"
                      onClick={() => handleManageSubscription("cancel")}
                      disabled={actionLoading === "cancel"}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      {actionLoading === "reactivate" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Check className="w-4 h-4 mr-2" />
                      Reactivate
                    </Button>
                  )}
                </>
              )}
            </div>
            {/* Add this after the existing action buttons div */}
            {process.env.NODE_ENV === "development" && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">Development Tools:</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      console.log("=== TESTING API ROUTE ===")
                      try {
                        const response = await fetch("/api/stripe/manage-subscription", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            userId: user?.id,
                            action: "cancel",
                          }),
                        })
                        console.log("Test response status:", response.status)
                        const data = await response.text()
                        console.log("Test response:", data.substring(0, 500))
                      } catch (err) {
                        console.error("Test error:", err)
                      }
                    }}
                  >
                    🧪 Test Cancel API
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      console.log("=== CURRENT USER STATE ===")
                      console.log("User:", user)
                      console.log("Is Pro:", isProUser)
                      console.log("Is Canceling:", isCanceling)
                    }}
                  >
                    📊 Log User State
                  </Button>
                </div>
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
