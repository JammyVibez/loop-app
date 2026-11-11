"use client"

import Link from "next/link"
import { ArrowLeft, Smartphone } from "@/components/icons/lucide-compat"
import {
  AndroidDirectInstall,
  IosComingSoon,
  DesktopComingSoon,
} from "@/components/app-download-section"

export function DownloadPageClient() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-lg px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Loop
        </Link>

        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Get Loop on your device
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Loop is a social platform where you build together, not just post
            into the void. Get the native app experience on your phone.
          </p>
        </div>

        <div className="space-y-4">
          <AndroidDirectInstall />
          <IosComingSoon />
          <DesktopComingSoon />
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Questions about installation?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
