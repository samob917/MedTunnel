"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Crown, Users, Zap } from "lucide-react"

interface LimitReachedModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userType: "anonymous" | "free" | "pro"
  onSignUp?: () => void
  onUpgrade?: () => void
}

export function LimitReachedModal({ open, onOpenChange, userType, onSignUp, onUpgrade }: LimitReachedModalProps) {
  if (userType === "anonymous") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Conversion Limit Reached</DialogTitle>
            <DialogDescription className="text-center">
              You've used all 3 anonymous conversions. Choose your next step:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              {/* Free Account Option */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold">Free Account</h3>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 5 conversions per month</li>
                  <li>• Save your progress</li>
                  <li>• Access from any device</li>
                </ul>
                <Button onClick={onSignUp} className="w-full bg-transparent" variant="outline">
                  Sign Up for Free
                </Button>
              </div>

              {/* Premium Option */}
              <div className="border rounded-lg p-4 space-y-3 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-semibold">Premium Account</h3>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">$2/month</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Unlimited conversions</li>
                  <li>• Priority support</li>
                  <li>• Advanced export options</li>
                  <li>• Configuration saving</li>
                </ul>
                <Button onClick={onUpgrade} className="w-full">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (userType === "free") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Monthly Limit Reached</DialogTitle>
            <DialogDescription className="text-center">
              You've used all 5 free conversions this month. Upgrade for unlimited access!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border rounded-lg p-6 space-y-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
              <div className="text-center">
                <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">MedTunnel Premium</h3>
                <p className="text-2xl font-bold text-gray-900">
                  $2<span className="text-sm font-normal">/month</span>
                </p>
              </div>

              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  Unlimited conversions
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  Advanced export options
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  Configuration saving
                </li>
              </ul>

              <Button onClick={onUpgrade} className="w-full" size="lg">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
