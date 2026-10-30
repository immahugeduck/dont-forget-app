"use client"

import { AppErrorScreen } from "@/components/app-error-screen"
import "./globals.css"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        <AppErrorScreen error={error} reset={reset} />
      </body>
    </html>
  )
}
