"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { AdminQuestsPanel } from "@/components/admin/admin-quests-panel"
import { useAuth } from "@/hooks/use-auth"
import { PageLoading } from "@/components/loading-states"
import { Shield } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AdminQuestsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/login?redirect=/admin/quests")
      setChecked(true)
    }
  }, [loading, user, router])

  if (loading || !checked) {
    return <PageLoading message="Loading quest management…" />
  }

  if (!user) {
    return <PageLoading message="Redirecting to login…" />
  }

  if (!user.is_admin) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 px-4 py-24 text-center">
          <Shield className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Admins only</h1>
          <Button asChild variant="outline">
            <Link href="/">Back home</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Quest Management</h1>
          <p className="text-sm text-muted-foreground">
            Build, publish, and analyze quests — video, surveys, games, missions, and community activities.
          </p>
        </div>
        <AdminQuestsPanel />
      </main>
    </div>
  )
}
