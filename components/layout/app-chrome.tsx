"use client"

import { usePathname } from "next/navigation"
import type React from "react"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { AppUpdateBanner } from "@/components/app-update-banner"

/**
 * Wraps page content inside the global layout.
 *
 * The /messages page is intentionally full-viewport on phones (WhatsApp-style
 * chat), so it renders its own spacing and its own bottom-nav placement. For
 * every other route we keep the standard mobile bottom nav + safe padding.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMessagesPage = pathname === "/messages" || pathname.startsWith("/messages/")

  return (
    <>
      <div className={`flex-1 min-w-0 ${isMessagesPage ? "pb-0" : "pb-20 lg:pb-0"}`}>
        <AppUpdateBanner />
        {children}
      </div>
      {!isMessagesPage && <MobileBottomNav />}
    </>
  )
}
