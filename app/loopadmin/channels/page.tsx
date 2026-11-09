"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield } from "lucide-react"
import { Header } from "@/components/header"
import { PageHeader } from "@/components/ui/page-header"
import { PageLoading } from "@/components/loading-states"
import { Button } from "@/components/ui/button"
import { AdminChannelsPanel } from "@/components/admin/admin-channels-panel"
import { useAuth } from "@/hooks/use-auth"

export default function AdminChannelsPage() {
  const { user, loading, authResolved } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && authResolved && !user) {
      router.replace("/login?redirect=/loopadmin/channels")
    }
  }, [loading, authResolved, user, router])

  if (loading) return <PageLoading message="Loading channels…" />
  if (!user) return <PageLoading message="Redirecting to login…" />

  if (!user.staff_role && !user.is_admin && !user.is_moderator) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 px-4 py-24 text-center">
          <Shield className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Admins only</h1>
          <p className="text-muted-foreground">
            Uploading movies and shows needs a staff role. Ask a Developer or Admin to assign one.
          </p>
          <Button asChild variant="outline">
            <Link href="/channels">Back to Channels</Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
        <PageHeader
          eyebrow="Staff"
          title="Channels library"
          description="Upload the movies and shows that play in Channels. Files are stored on our own servers and served through the media CDN."
          className="mb-6"
        />
        <AdminChannelsPanel />
      </main>
    </div>
  )
}
