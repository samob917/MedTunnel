"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "./auth-provider"

export function DebugUser() {
  const { user } = useAuth()
  const [supabaseTest, setSupabaseTest] = useState<any>(null)
  const [userTest, setUserTest] = useState<any>(null)

  const testSupabase = async () => {
    try {
      const response = await fetch("/api/debug/supabase")
      const data = await response.json()
      setSupabaseTest(data)
    } catch (error) {
      setSupabaseTest({ error: error instanceof Error ? error.message : "Unknown error" })
    }
  }

  const testUser = async () => {
    if (!user?.id) return

    try {
      const response = await fetch("/api/debug/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await response.json()
      setUserTest(data)
    } catch (error) {
      setUserTest({ error: error instanceof Error ? error.message : "Unknown error" })
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium">Current User:</h4>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(user, null, 2)}</pre>
        </div>

        <div className="flex gap-2">
          <Button onClick={testSupabase} size="sm">
            Test Supabase
          </Button>
          <Button onClick={testUser} size="sm" disabled={!user?.id}>
            Test User Query
          </Button>
        </div>

        {supabaseTest && (
          <div>
            <h4 className="font-medium">Supabase Test:</h4>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(supabaseTest, null, 2)}</pre>
          </div>
        )}

        {userTest && (
          <div>
            <h4 className="font-medium">User Test:</h4>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(userTest, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
