"use client"

import { Suspense } from "react"
import { Header } from "@/components/header"
import { EnhancedSettings } from "@/components/settings/enhanced-settings"

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
          <p className="text-muted-foreground">Manage your profile, theme, notifications, and privacy.</p>
        </div>
        <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground">Loading settings…</div>}>
          <EnhancedSettings />
        </Suspense>
      </main>
    </div>
  )
}
