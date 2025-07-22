"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthContextType {
  user:
    | (User & {
        subscription_tier?: string
        subscription_status?: string
        subscription_current_period_end?: string
        subscription_cancel_at_period_end?: boolean
      })
    | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  usageCount: number
  canUseService: boolean
  incrementUsage: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<
    | (User & {
        subscription_tier?: string
        subscription_status?: string
        subscription_current_period_end?: string
        subscription_cancel_at_period_end?: boolean
      })
    | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [usageCount, setUsageCount] = useState(0)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserUsage(session.user.id)
      } else {
        // Load anonymous usage from localStorage
        const anonymousUsage = localStorage.getItem("anonymous_usage_count")
        setUsageCount(anonymousUsage ? Number.parseInt(anonymousUsage, 10) : 0)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchUserUsage(session.user.id)
      } else {
        // Load anonymous usage from localStorage when signing out
        const anonymousUsage = localStorage.getItem("anonymous_usage_count")
        setUsageCount(anonymousUsage ? Number.parseInt(anonymousUsage, 10) : 0)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserUsage = async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select(
        "usage_count, subscription_tier, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end",
      )
      .eq("id", userId)
      .single()

    if (data) {
      setUsageCount(data.usage_count || 0)
      // Merge subscription data with user object
      if (user) {
        setUser({
          ...user,
          subscription_tier: data.subscription_tier,
          subscription_status: data.subscription_status,
          subscription_current_period_end: data.subscription_current_period_end,
          subscription_cancel_at_period_end: data.subscription_cancel_at_period_end,
        })
      }
    }
  }

  const refreshUser = async () => {
    if (user) {
      await fetchUserUsage(user.id)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  
  const incrementUsage = async () => {
    if (user) {
      // For signed-in users, update database
      const { error } = await supabase
        .from("users")
        .update({ usage_count: usageCount + 1 })
        .eq("id", user.id)

      if (!error) {
        setUsageCount((prev) => prev + 1)
      }
    } else {
      // For anonymous users, update localStorage
      const newCount = usageCount + 1
      setUsageCount(newCount)
      localStorage.setItem("anonymous_usage_count", newCount.toString())
    }
  }

  // Check if user can use service based on subscription
  const isProUser = user?.subscription_tier === "pro" && user?.subscription_status === "active"
  const canUseService = user ? isProUser || usageCount < 5 : usageCount < 3

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        usageCount,
        canUseService,
        incrementUsage,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
