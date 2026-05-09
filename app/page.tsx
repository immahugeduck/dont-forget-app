import { PlannerPage } from "@/components/planner-page"

// Prevent prerendering since this page requires Supabase client with env vars
export const dynamic = "force-dynamic"

export default function Page() {
  return <PlannerPage />
}
