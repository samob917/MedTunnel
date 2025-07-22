import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface RouteParams {
  params: {
    id: string
  }
}

/* ----------  PUT  ---------- */
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const { params } = context
    const body = await request.json()
    const authHeader = request.headers.get("authorization")

    if (!authHeader) return NextResponse.json({ error: "Authorization header required" }, { status: 401 })

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })

    const { name, description, clinicMappings, residentMappings, mergedClinics, isDefault } = body

    // ownership check
    const { data: cfg, error: ownErr } = await supabaseAdmin
      .from("amion_configurations")
      .select("user_id")
      .eq("id", params.id)
      .single()

    if (ownErr || !cfg) return NextResponse.json({ error: "Configuration not found" }, { status: 404 })
    if (cfg.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    if (isDefault) {
      await supabaseAdmin
        .from("amion_configurations")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("id", params.id)
    }

    const { data, error } = await supabaseAdmin
      .from("amion_configurations")
      .update({
        name,
        description,
        clinic_mappings: clinicMappings,
        resident_mappings: residentMappings,
        merged_clinics: mergedClinics,
        is_default: isDefault,
      })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      const status = error.code === "23503" ? 400 : 500
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }

    return NextResponse.json({ configuration: data })
  } catch (e) {
    console.error("PUT exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* ----------  DELETE  ---------- */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const { params } = context
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Authorization header required" }, { status: 401 })

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })

    const { data: cfg, error: ownErr } = await supabaseAdmin
      .from("amion_configurations")
      .select("user_id")
      .eq("id", params.id)
      .single()

    if (ownErr || !cfg) return NextResponse.json({ error: "Configuration not found" }, { status: 404 })
    if (cfg.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const { error } = await supabaseAdmin.from("amion_configurations").delete().eq("id", params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("DELETE exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
