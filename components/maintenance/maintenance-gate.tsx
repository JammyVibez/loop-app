"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useAuth } from "@/hooks/use-auth"
import { MaintenanceScreen } from "@/components/maintenance/maintenance-screen"

interface MaintenanceInfo {
  enabled: boolean
  message?: string
  developer_notes?: string
}

/**
 * MaintenanceGate — when an admin enables maintenance mode, every non-admin
 * visitor sees only the maintenance screen (nothing else renders). Admins pass
 * through so they can still reach the admin dashboard to turn it off.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [info, setInfo] = useState<MaintenanceInfo | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return
        const mm = data?.settings?.maintenance_mode
        if (mm) {
          setInfo({ enabled: Boolean(mm.enabled), message: mm.message, developer_notes: mm.developer_notes })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecked(true)
      })
    return () => {
      active = false
    }
  }, [])

  // While the setting loads, render children normally (avoid a flash of the
  // maintenance screen for every visitor on every page load).
  if (!checked || !info) return <>{children}</>

  const isAdmin = Boolean(user?.is_admin)
  if (info.enabled && !isAdmin) {
    return <MaintenanceScreen info={info} />
  }

  return <>{children}</>
}
