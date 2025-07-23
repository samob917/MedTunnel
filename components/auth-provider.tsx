"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  email: string
  subscription_tier: "free" | "pro" | "enterprise"
  subscription_status: string | null
  usage_count: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_cancel_at_period_end: boolean | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  usageCount: number
  canUseService: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  incrementUsage: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Enhanced user refresh function
  const refreshUser = async () => {
    console.log("=== REFRESHING USER DATA ===")

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        console.error("Session error during refresh:", sessionError)
        setUser(null)
        return
      }

      if (!session?.user) {
        console.log("No session found during refresh")
        setUser(null)
        return
      }

      console.log("Session found, fetching fresh user data for:", session.user.id)

      // Fetch fresh user data from database
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (userError) {
        console.error("Error fetching user data during refresh:", userError)
        setUser(null)
        return
      }

      if (userData) {
        console.log("✅ Fresh user data loaded:", {
          email: userData.email,
          tier: userData.subscription_tier,
          status: userData.subscription_status,
          usage: userData.usage_count,
        })

        setUser(userData)
      } else {
        console.log("No user data found during refresh")
        setUser(null)
      }
    } catch (error) {
      console.error("Exception during user refresh:", error)
      setUser(null)
    }
  }

  // Load user on mount and set up auth listener
  useEffect(() => {
    console.log("=== AUTH PROVIDER INITIALIZING ===")

    const initializeAuth = async () => {
      try {
        // Get initial session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("Initial session error:", sessionError)
          setLoading(false)
          return
        }

        if (session?.user) {
          console.log("Initial session found for:", session.user.email)

          // Fetch user data from our users table
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single()

          if (userError) {
            console.error("Error fetching initial user data:", userError)
          } else if (userData) {
            console.log("✅ Initial user data loaded:", {
              email: userData.email,
              tier: userData.subscription_tier,
              status: userData.subscription_status,
              usage: userData.usage_count,
            })
            setUser(userData)
          }
        } else {
          console.log("No initial session found")
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("=== AUTH STATE CHANGE ===", event)

      if (event === "SIGNED_IN" && session?.user) {
        console.log("User signed in:", session.user.email)
        await refreshUser()
      } else if (event === "SIGNED_OUT") {
        console.log("User signed out")
        setUser(null)
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        console.log("Token refreshed, refreshing user data")
        await refreshUser()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log("=== SIGNING IN ===", email)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Sign in error:", error)
      throw error
    }

    if (data.user) {
      console.log("Sign in successful, refreshing user data")
      await refreshUser()
    }
  }

  const signUp = async (email: string, password: string) => {
    console.log("=== SIGNING UP ===", email)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      console.error("Sign up error:", error)
      throw error
    }

    if (data.user) {
      console.log("Sign up successful")
      // User data will be created by database trigger
      // Refresh after a short delay to allow trigger to complete
      setTimeout(async () => {
        await refreshUser()
      }, 1000)
    }
  }

  const signOut = async () => {
    console.log("=== SIGNING OUT ===")

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("Sign out error:", error)
      throw error
    }
    setUser(null)
  }

  const incrementUsage = async () => {
    if (!user) return

    console.log("=== INCREMENTING USAGE ===")

    try {
      const { data, error } = await supabase
        .from("users")
        .update({ usage_count: user.usage_count + 1 })
        .eq("id", user.id)
        .select()
        .single()

      if (error) {
        console.error("Error incrementing usage:", error)
        throw error
      }

      if (data) {
        console.log("✅ Usage incremented:", data.usage_count)
        setUser(data)
      }
    } catch (error) {
      console.error("Exception incrementing usage:", error)
      throw error
    }
  }

  // Calculate usage limits
  const usageCount = user?.usage_count || 0
  const isProUser = user?.subscription_tier === "pro" && user?.subscription_status === "active"

  const canUseService = user
    ? isProUser || usageCount < 5 // Pro users have unlimited, free users have 5
    : usageCount < 3 // Anonymous users have 3

  console.log("=== AUTH CONTEXT STATE ===", {
    hasUser: !!user,
    email: user?.email,
    tier: user?.subscription_tier,
    status: user?.subscription_status,
    usage: usageCount,
    isProUser,
    canUseService,
    loading,
  })

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        usageCount,
        canUseService,
        signIn,
        signUp,
        signOut,
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
