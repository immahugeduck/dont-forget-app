import { Zap } from "lucide-react"
import type { ReactNode } from "react"

/** Shared frame for the sign-in / sign-up / password pages (phone first). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center px-5 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center" aria-hidden="true">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Don&apos;t Forget</span>
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}
