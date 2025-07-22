import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// GET - Get specific configuration
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: configuration, error } = await supabase
      .from("configurations")
      .select("*")
      .eq("id", params.id)
      .single()

    if (error) {
      console.error("Error fetching configuration:", error)
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 })
    }

    return NextResponse.json({ configuration })
  } catch (error) {
    console.error("Configuration fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update configuration
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { name, description, configData, isDefault, userId } = body

    // If setting as default, unset other defaults first
    if (isDefault && userId) {
      await supabase
        .from("configurations")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("tunnel_id", "amion")
        .neq("id", params.id)
    }

    const { data: configuration, error } = await supabase
      .from("configurations")
      .update({
        name,
        description,
        config_data: configData,
        is_default: isDefault,
      })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating configuration:", error)
      return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 })
    }

    return NextResponse.json({ configuration })
  } catch (error) {
    console.error("Configuration update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete configuration
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase.from("configurations").delete().eq("id", params.id)

    if (error) {
      console.error("Error deleting configuration:", error)
      return NextResponse.json({ error: "Failed to delete configuration" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Configuration deletion error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
