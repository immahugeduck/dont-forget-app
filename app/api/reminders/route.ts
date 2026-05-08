import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: reminders, error } = await supabase
    .from("task_reminders")
    .select("*")
    .eq("user_id", user.id)

  if (error) {
    console.error("Error fetching reminders:", error)
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 })
  }

  return NextResponse.json({ reminders: reminders ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { checklistId: string; reminderDatetime: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { checklistId, reminderDatetime } = body

  if (!checklistId || !reminderDatetime) {
    return NextResponse.json({ error: "Missing checklistId or reminderDatetime" }, { status: 400 })
  }

  // Validate the datetime
  const reminderDate = new Date(reminderDatetime)
  if (isNaN(reminderDate.getTime())) {
    return NextResponse.json({ error: "Invalid datetime format" }, { status: 400 })
  }

  // Don't allow reminders in the past
  if (reminderDate < new Date()) {
    return NextResponse.json({ error: "Reminder time must be in the future" }, { status: 400 })
  }

  // Upsert the reminder (one reminder per checklist item)
  const { data: reminder, error } = await supabase
    .from("task_reminders")
    .upsert(
      {
        user_id: user.id,
        checklist_id: checklistId,
        reminder_datetime: reminderDatetime,
        sent: false,
      },
      { onConflict: "checklist_id" }
    )
    .select()
    .single()

  if (error) {
    console.error("Error creating reminder:", error)
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 })
  }

  return NextResponse.json({ reminder })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { checklistId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { checklistId } = body

  if (!checklistId) {
    return NextResponse.json({ error: "Missing checklistId" }, { status: 400 })
  }

  const { error } = await supabase
    .from("task_reminders")
    .delete()
    .eq("user_id", user.id)
    .eq("checklist_id", checklistId)

  if (error) {
    console.error("Error deleting reminder:", error)
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
