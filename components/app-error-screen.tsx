"use client"

import { useEffect, useState } from "react"

interface AppErrorScreenProps {
  error: Error & { digest?: string }
  reset: () => void
}

async function clearDeviceData() {
  try {
    window.localStorage.clear()
    window.sessionStorage.clear()
  } catch {
    /* storage unavailable (private mode) */
  }
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  }
  if ("caches" in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
}

export function AppErrorScreen({ error, reset }: AppErrorScreenProps) {
  const [clearing, setClearing] = useState(false)
  const [copied, setCopied] = useState(false)

  const details = [error.name, error.message, error.digest ? `digest: ${error.digest}` : "", error.stack?.split("\n").slice(0, 6).join("\n") ?? ""]
    .filter(Boolean)
    .join("\n")

  useEffect(() => {
    console.error("[app-error]", error)
  }, [error])

  const handleReset = async () => {
    setClearing(true)
    await clearDeviceData()
    window.location.replace("/")
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-2xl font-semibold">{"Don't Forget hit a problem"}</h1>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            Something on this device stopped the app from loading. Try again first. If it keeps happening, reset app
            data on this device. Anything synced to your account stays safe, but you may need to sign in again.
          </p>
        </div>

        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {details || "No error details available."}
        </pre>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={clearing}
            className="min-h-11 rounded-lg border border-border bg-card px-4 text-base font-medium text-card-foreground disabled:opacity-60"
          >
            {clearing ? "Resetting..." : "Reset app data and reload"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-11 rounded-lg px-4 text-base text-muted-foreground underline-offset-4 hover:underline"
          >
            {copied ? "Copied error details" : "Copy error details"}
          </button>
        </div>
      </div>
    </main>
  )
}
