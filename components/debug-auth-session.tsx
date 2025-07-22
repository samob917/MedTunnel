"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./auth-provider"

export function DebugAuthSession() {
  const { user } = useAuth()
  const [sessionTest, setSessionTest] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testSession = async () => {
    setLoading(true)
    setSessionTest(null)

    try {
      console.log("=== TESTING SESSION ===")

      // Test 1: Basic session check
      console.log("1. Getting session...")
      const sessionStart = Date.now()

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()
      const sessionTime = Date.now() - sessionStart

      console.log("Session call took:", sessionTime, "ms")
      console.log("Session error:", error)
      console.log("Session data:", session)

      // Test 2: User check
      console.log("2. Getting user...")
      const userStart = Date.now()

      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser()
      const userTime = Date.now() - userStart

      console.log("User call took:", userTime, "ms")
      console.log("User error:", userError)
      console.log("User data:", authUser)

      // Test 3: Manual token test
      if (session?.access_token) {
        console.log("3. Testing token manually...")
        const tokenStart = Date.now()

        const {
          data: { user: tokenUser },
          error: tokenError,
        } = await supabase.auth.getUser(session.access_token)
        const tokenTime = Date.now() - tokenStart

        console.log("Token test took:", tokenTime, "ms")
        console.log("Token error:", tokenError)
        console.log("Token user:", tokenUser)
      }

      setSessionTest({
        session: session
          ? {
              access_token: session.access_token ? `${session.access_token.substring(0, 20)}...` : null,
              refresh_token: session.refresh_token ? `${session.refresh_token.substring(0, 20)}...` : null,
              expires_at: session.expires_at,
              user: session.user
                ? {
                    id: session.user.id,
                    email: session.user.email,
                  }
                : null,
            }
          : null,
        sessionError: error,
        sessionTime,
        authUser: authUser
          ? {
              id: authUser.id,
              email: authUser.email,
            }
          : null,
        userError,
        userTime,
        contextUser: user
          ? {
              id: user.id,
              email: user.email,
            }
          : null,
      })
    } catch (err) {
      console.error("Session test error:", err)
      setSessionTest({
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setLoading(false)
    }
  }

  const testDirectApiCall = async () => {
    try {
      console.log("=== TESTING DIRECT API CALL ===")

      if (!user?.id) {
        console.log("No user ID available")
        return
      }

      // Get session first
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        console.error("No valid session for API call:", sessionError)
        return
      }

      console.log("Making direct API call...")
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      try {
        const response = await fetch(`/api/amion-configurations?userId=${user.id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        console.log("API Response status:", response.status)
        console.log("API Response headers:", Object.fromEntries(response.headers.entries()))

        const responseText = await response.text()
        console.log("API Response text (first 500 chars):", responseText.substring(0, 500))

        try {
          const responseJson = JSON.parse(responseText)
          console.log("API Response JSON:", responseJson)
        } catch {
          console.log("Response is not JSON - likely HTML error page")
          console.log("Full response:", responseText)
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          console.error("API call timed out after 10 seconds")
        } else {
          console.error("Fetch error:", fetchError)
        }
      }
    } catch (err) {
      console.error("Direct API call error:", err)
    }
  }

  const testDebugEndpoints = async () => {
    try {
      console.log("=== TESTING DEBUG ENDPOINTS ===")

      // Test Supabase debug endpoint
      console.log("Testing /api/debug/supabase...")
      const supabaseResponse = await fetch("/api/debug/supabase")
      const supabaseText = await supabaseResponse.text()
      console.log("Supabase debug response:", supabaseText)

      // Test user debug endpoint
      if (user?.id) {
        console.log("Testing /api/debug/user...")
        const userResponse = await fetch("/api/debug/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        })
        const userText = await userResponse.text()
        console.log("User debug response:", userText)
      }
    } catch (err) {
      console.error("Debug endpoints test error:", err)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Auth Session Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={testSession} disabled={loading} size="sm">
            {loading ? "Testing..." : "Test Session"}
          </Button>
          <Button onClick={testDirectApiCall} disabled={!user?.id} size="sm" variant="outline">
            Test Direct API Call
          </Button>
          <Button onClick={testDebugEndpoints} size="sm" variant="outline">
            Test Debug Endpoints
          </Button>
        </div>

        {sessionTest && (
          <div>
            <h4 className="font-medium mb-2">Session Test Results:</h4>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(sessionTest, null, 2)}
            </pre>
          </div>
        )}

        <Alert>
          <AlertDescription>
            <div className="space-y-1 text-sm">
              <p>
                <strong>Current User ID:</strong> {user?.id || "None"}
              </p>
              <p>
                <strong>Current User Email:</strong> {user?.email || "None"}
              </p>
              <p>
                <strong>Expected User ID:</strong> 3fc37f02-f1bc-4621-9c9c-4bd28ec90ab5
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
