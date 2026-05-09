import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: categories, error } = await supabase
    .from("user_categories")
    .select("*")
    .eq("user_id", user.id)
    .order("position", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ categories })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, color, icon } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  // Get the highest position to add new category at the end
  const { data: existingCategories } = await supabase
    .from("user_categories")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = existingCategories && existingCategories.length > 0 
    ? existingCategories[0].position + 1 
    : 0

  const { data: category, error } = await supabase
    .from("user_categories")
    .insert({
      user_id: user.id,
      name: name.trim(),
      color: color || "#8b5cf6",
      icon: icon || "folder",
      position: nextPosition,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Category already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { id, name, color, icon, position } = body

  if (!id) {
    return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name.trim()
  if (color !== undefined) updateData.color = color
  if (icon !== undefined) updateData.icon = icon
  if (position !== undefined) updateData.position = position

  const { data: category, error } = await supabase
    .from("user_categories")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
