import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Regular Supabase client (respects RLS)
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log("=== TEST SAVE ENDPOINT ===")

    const body = await request.json()
    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required for RLS test" },
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      console.error("Auth error:", authError)
      return NextResponse.json(
        { error: "Invalid authentication", details: authError?.message },
        { status: 401 }
      )
    }

    // Test insert with the real, authenticated user
    const testInsert = {
      user_id: user.id,
      name: "Test Configuration",
      description: "Test description",
      clinic_mappings: { test: "test" },
      resident_mappings: { test: "test" },
      merged_clinics: { test: ["test1", "test2"] },
      is_default: false,
    }

    const { data: insertResult, error: insertError } = await supabaseAuth
      .from("amion_configurations")
      .insert(testInsert)
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        {
          error: "Test insert failed",
          details: insertError.message,
          code: insertError.code,
        },
        { status: 500 }
      )
    }

    // Clean up
    await supabaseAuth.from("amion_configurations").delete().eq("id", insertResult.id)

    return NextResponse.json({
      success: true,
      message: "Test save successful with RLS!",
      userId: user.id,
    })
  } catch (e) {
    return NextResponse.json(
      { error: "Test failed", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 }
    )
  }
}