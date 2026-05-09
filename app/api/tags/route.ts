import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET - Fetch all user tags
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: tags, error } = await supabase
    .from("user_tags")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tags })
}

// POST - Create a new tag or get existing
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, color } = await request.json()

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 })
  }

  // Normalize tag name (lowercase, trim, remove # if present)
  const normalizedName = name.toLowerCase().trim().replace(/^#/, "")

  if (!normalizedName) {
    return NextResponse.json({ error: "Invalid tag name" }, { status: 400 })
  }

  // Check if tag already exists
  const { data: existingTag } = await supabase
    .from("user_tags")
    .select("*")
    .eq("user_id", user.id)
    .eq("name", normalizedName)
    .single()

  if (existingTag) {
    return NextResponse.json({ tag: existingTag })
  }

  // Create new tag with random color if not specified
  const tagColor = color || getRandomTagColor()

  const { data: newTag, error } = await supabase
    .from("user_tags")
    .insert({
      user_id: user.id,
      name: normalizedName,
      color: tagColor,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tag: newTag }, { status: 201 })
}

// PATCH - Update a tag
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, name, color } = await request.json()

  if (!id) {
    return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
  }

  const updates: Record<string, string> = {}
  if (name) updates.name = name.toLowerCase().trim().replace(/^#/, "")
  if (color) updates.color = color

  const { data: tag, error } = await supabase
    .from("user_tags")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tag })
}

// DELETE - Delete a tag
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_tags")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Helper: Generate random tag color
function getRandomTagColor(): string {
  const colors = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#a855f7", // purple
    "#ec4899", // pink
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
