import { NextResponse } from "next/server"
import { isWebPushConfigured } from "@/lib/webpush"
import { isFcmConfigured } from "@/lib/fcm"

export const dynamic = "force-dynamic"

// Tells the client which delivery channels the server can actually use, so
// the UI can hide or degrade features instead of failing.
export async function GET() {
  return NextResponse.json({ webPush: isWebPushConfigured(), fcm: isFcmConfigured() })
}
