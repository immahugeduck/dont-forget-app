import { createRequire } from "node:module"
import { writeFileSync } from "node:fs"
const require = createRequire("/vercel/share/v0-project/package.json")
const { createClient } = require("@supabase/supabase-js")

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const email = `v0-debug-${Date.now()}@dontforget-debug.dev`
const password = `Dbg-${Math.random().toString(36).slice(2)}-${Date.now()}`

const { data: created, error: createErr } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
if (createErr) throw createErr
const uid = created.user.id

const cats = [
  { user_id: uid, name: "Subscriptions", color: "#8b5cf6", icon: "user", position: 0 },
  { user_id: uid, name: "Work", color: "#3b82f6", icon: "briefcase", position: 1 },
  { user_id: uid, name: "Home", color: "#22c55e", icon: "home", position: 2 },
]
const { error: catErr } = await sb.from("user_categories").insert(cats)
if (catErr) console.log("categories:", catErr.message)

const days = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]
const rows = []
days.forEach((d, di) => {
  for (let i = 0; i < 4; i++) {
    rows.push({
      user_id: uid,
      date: d,
      slot_id: d,
      category: "subscriptions",
      text: `Test task ${i + 1} #tag${i}`,
      completed: i === 0,
      position: i,
      due_time: i % 2 === 0 ? `${String(8 + i + di).padStart(2, "0")}:30:00` : null,
    })
  }
})
const { error: clErr } = await sb.from("checklists").insert(rows)
if (clErr) console.log("checklists:", clErr.message)

const notes = days.map((d) => ({ user_id: uid, date: d, content: `Note for ${d}` }))
const { error: noteErr } = await sb.from("notes").insert(notes)
if (noteErr) console.log("notes:", noteErr.message)

writeFileSync("/tmp/v0-debug-creds.json", JSON.stringify({ email, password, uid }))
console.log("created test user", uid, "checklists:", rows.length, "notes:", notes.length)
