"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Crown, CreditCard, X, Check } from "lucide-react"
import { useAuth } from "./auth-provider"
import { getStripe } from "@/lib/stripe"


interface SubscriptionManagerProps {
  onClose?: () => void
}

export function SubscriptionManager({ onClose }: SubscriptionManagerProps) {
  const { user, usageCount, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const isProUser = user?.subscription_tier === "pro" && user?.subscription_status === "active"
  const isCanceling = user?.subscription_cancel_at_period_end

  const handleUpgrade = async () => {
    if (!user) return

    setLoading(true)
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
        throw new Error("Failed to create checkout session")
      }

      const { sessionId } = await response.json()
      const stripe = await getStripe()

      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId })
        if (error) {
          console.error("Stripe checkout error:", error)
          alert("Failed to redirect to checkout. Please try again.")
        }
      }
    } catch (error) {
      console.error("Error creating checkout session:", error)
      alert("Failed to start checkout. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async (action: "cancel" | "reactivate" | "portal") => {
    if (!user) return

    setActionLoading(action)
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
        throw new Error("Failed to manage subscription")
      }

      const result = await response.json()

      if (action === "portal" && result.url) {
        window.open(result.url, "_blank")
      } else {
        // Refresh user data to get updated subscription status
        await refreshUser()
      }
    } catch (error) {
      console.error("Error managing subscription:", error)
      alert("Failed to manage subscription. Please try again.")
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-6">
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
              </CardTitle>
              <CardDescription>
                {isProUser ? "Unlimited conversions and premium features" : "Limited to 5 conversions"}
              </CardDescription>
            </div>
            <Badge variant={isProUser ? "default" : "secondary"}>{isProUser ? "Pro" : "Free"}</Badge>
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
            {isProUser && user?.subscription_current_period_end && (
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>Next billing date:</strong> {formatDate(user.subscription_current_period_end)}
                </p>
                {isCanceling && (
                  <p className="text-amber-600">
                    <strong>Status:</strong> Will cancel on {formatDate(user.subscription_current_period_end)}
                  </p>
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
