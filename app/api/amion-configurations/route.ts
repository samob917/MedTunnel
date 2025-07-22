import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role for database operations
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Use anon key for auth verification
const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

/* ----------  GET  ---------- */
export async function GET(request: NextRequest) {
  console.log("=== GET /api/amion-configurations START ===")

  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL")
      return NextResponse.json({ error: "Supabase URL not configured" }, { status: 500 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY")
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")
      return NextResponse.json({ error: "Anon key not configured" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const authHeader = request.headers.get("authorization")

    console.log("Request userId:", userId)
    console.log("Auth header present:", !!authHeader)

    if (!userId) {
      console.log("Missing userId parameter")
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    if (!authHeader) {
      console.log("Missing authorization header")
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    console.log("Token length:", token.length)

    // Test auth verification
    console.log("Verifying authentication...")
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token)

    if (authError) {
      console.error("Auth error:", authError)
      return NextResponse.json(
        {
          error: "Invalid authentication",
          details: authError.message,
          code: authError.code,
        },
        { status: 401 },
      )
    }

    if (!user) {
      console.error("No user returned from auth")
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    console.log("Authenticated user:", user.id, user.email)

    if (user.id !== userId) {
      console.error("User ID mismatch:", user.id, "vs", userId)
      return NextResponse.json({ error: "User ID mismatch" }, { status: 403 })
    }

    // Test database connection
    console.log("Testing database connection...")
    const { data: testData, error: testError } = await supabaseAdmin
      .from("amion_configurations")
      .select("count")
      .limit(1)

    if (testError) {
      console.error("Database connection test failed:", testError)
      return NextResponse.json(
        {
          error: "Database connection failed",
          details: testError.message,
          code: testError.code,
        },
        { status: 500 },
      )
    }

    console.log("Database connection test passed")

    console.log("Querying configurations for user:", userId)

    const { data, error } = await supabaseAdmin
      .from("amion_configurations")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Database query error:", error)
      return NextResponse.json(
        {
          error: "Database query failed",
          details: error.message,
          code: error.code,
        },
        { status: 500 },
      )
    }

    console.log("Query successful, found configurations:", data?.length || 0)
    console.log("=== GET /api/amion-configurations SUCCESS ===")

    return NextResponse.json({ configurations: data ?? [] })
  } catch (e) {
    console.error("=== GET /api/amion-configurations EXCEPTION ===")
    console.error("Exception:", e)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: e instanceof Error ? e.message : "Unknown error",
        stack: e instanceof Error ? e.stack : undefined,
      },
      { status: 500 },
    )
  }
}

// POST - Create new Amion configuration
export async function POST(request: NextRequest) {
  console.log("=== POST /api/amion-configurations START ===")

  try {
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const body = await request.json()
    const authHeader = request.headers.get("authorization")

    const {
      userId,
      name,
      description,
      clinicMappings = {},
      residentMappings = {},
      mergedClinics = {},
      isDefault = false,
    } = body

    console.log("POST request data:", { userId, name, hasAuth: !!authHeader })

    // Validate required fields
    if (!userId || !name?.trim()) {
      return NextResponse.json({ error: "User ID and name are required" }, { status: 400 })
    }

    if (!authHeader) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 })
    }

    // Verify authentication
    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      console.error("Auth error:", authError)
      return NextResponse.json(
        {
          error: "Invalid authentication",
          details: authError?.message,
        },
        { status: 401 },
      )
    }

    // Verify user ID matches authenticated user
    if (user.id !== userId) {
      return NextResponse.json({ error: "User ID mismatch" }, { status: 403 })
    }

    // Check if user exists in our users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .single()

    if (userError || !userData) {
      console.error("User not found in users table:", userError)
      return NextResponse.json({ error: "User not found. Please sign in again." }, { status: 404 })
    }

    console.log("Authenticated user:", user.id)

    // If setting as default, unset other defaults first
    if (isDefault) {
      console.log("Unsetting other defaults for user:", userId)
      const { error: updateError } = await supabaseAdmin
        .from("amion_configurations")
        .update({ is_default: false })
        .eq("user_id", userId)

      if (updateError) {
        console.error("Error unsetting defaults:", updateError)
        return NextResponse.json(
          { error: "Failed to update default configurations", details: updateError.message },
          { status: 500 },
        )
      }
    }

    console.log("Inserting new configuration...")
    const insertData = {
      user_id: userId,
      name: name.trim(),
      description: description || null,
      clinic_mappings: clinicMappings,
      resident_mappings: residentMappings,
      merged_clinics: mergedClinics,
      is_default: isDefault,
    }

    const { data: configuration, error } = await supabaseAdmin
      .from("amion_configurations")
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error("=== DATABASE INSERT ERROR ===")
      console.error("Error code:", error.code)
      console.error("Error message:", error.message)
      console.error("Error details:", error.details)

      return NextResponse.json(
        {
          error: "Failed to create configuration",
          details: error.message,
          code: error.code,
        },
        { status: 500 },
      )
    }

    console.log("Configuration created successfully:", configuration.id)
    return NextResponse.json({ configuration })
  } catch (error) {
    console.error("=== CONFIGURATION CREATION ERROR ===", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
