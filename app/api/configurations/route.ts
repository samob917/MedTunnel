import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET - List user's configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const tunnelId = searchParams.get("tunnelId") || "amion"

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const { data: configurations, error } = await supabase
      .from("configurations")
      .select("*")
      .eq("user_id", userId)
      .eq("tunnel_id", tunnelId)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Error fetching configurations:", error)
      return NextResponse.json({ error: "Failed to fetch configurations" }, { status: 500 })
    }

    return NextResponse.json({ configurations })
  } catch (error) {
    console.error("Configuration fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create new configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, description, tunnelId = "amion", configData, isDefault = false } = body

    if (!userId || !name || !configData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await supabase
        .from("configurations")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("tunnel_id", tunnelId)
    }

    const { data: configuration, error } = await supabase
      .from("configurations")
      .insert({
        user_id: userId,
        name,
        description,
        tunnel_id: tunnelId,
        config_data: configData,
        is_default: isDefault,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating configuration:", error)
      return NextResponse.json({ error: "Failed to create configuration" }, { status: 500 })
    }

    return NextResponse.json({ configuration })
  } catch (error) {
    console.error("Configuration creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
