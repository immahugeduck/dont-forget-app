import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { NativeShell } from "@/components/native-shell"
import { AppToaster } from "@/components/app-toaster"
import { InstallPrompt } from "@/components/install-prompt"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Don't Forget | Weekly Planner",
  description: "Your premium weekly planning companion",
  manifest: "/manifest.json",
  // iPhone/iPad: open full-screen from the Home Screen (needed for push on iOS).
  appleWebApp: { capable: true, title: "Don't Forget", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available (accessibility). Inputs use 16px text on
  // phones, so iOS doesn't auto-zoom when you tap one.
  viewportFit: "cover",
  themeColor: "#0A0A0C",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <NativeShell />
        <InstallPrompt />
        <AppToaster />
        <Analytics />
      </body>
    </html>
  )
}
