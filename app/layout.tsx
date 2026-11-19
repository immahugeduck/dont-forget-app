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
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available (accessibility). Inputs use 16px text on
  // phones, so iOS doesn't auto-zoom when you tap one.
  viewportFit: "cover",
  themeColor: "#0f0f11",
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
