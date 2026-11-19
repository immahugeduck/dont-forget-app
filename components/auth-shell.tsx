import Image from "next/image"
import type { ReactNode } from "react"

/** Shared frame for the sign-in / sign-up / password pages (phone first). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center px-5 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center mb-2">
            <Image src="/brand/logo-stacked-transparent.png" alt="Don't Forget: reminders & events" width={554} height={473} priority className="w-44 h-auto" />
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}
