"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Header } from "@/components/header"
import { MomentCard, MomentGone } from "@/components/engagement/moment-card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/skeletons"

export default function MomentPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [moment, setMoment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      const res = await fetch(`/api/moments/${id}`, { headers: getAuthHeader() })
      const data = await res.json()
      if (!res.ok || !data.moment) {
        setNotFound(true)
        return
      }
      setMoment(data.moment)
      setDraft(data.moment.content || "")
      // Count this as a view (fire-and-forget).
      void fetch(`/api/moments/${id}/view`, { method: "POST", headers: getAuthHeader() }).catch(() => {})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/moments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content: draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      setMoment(data.moment)
      setEditing(false)
      toast({ title: "Moment updated" })
    } catch (error: any) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/moments/${id}`, { method: "DELETE", headers: getAuthHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      toast({ title: "Moment deleted" })
      router.push("/")
    } catch (error: any) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" })
      setDeleting(false)
    }
  }

  const isMine = user?.id === moment?.user_id
  const author = Array.isArray(moment?.author) ? moment?.author[0] : moment?.author

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
          <Spinner className="mr-2 h-5 w-5" /> Loading moment…
        </div>
      </div>
    )
  }

  const durationHours = (() => {
    if (!moment?.created_at || !moment?.expires_at) return 24
    const hours = Math.round((new Date(moment.expires_at).getTime() - new Date(moment.created_at).getTime()) / 3600000)
    return Math.min(48, Math.max(24, hours || 24))
  })()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-lg px-3 py-6">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

        {notFound || !moment ? (
          <MomentGone />
        ) : (
          <div className="space-y-3">
            <MomentCard
              moment={moment}
              author={author}
              isMine={isMine}
              durationHours={durationHours}
              onEdit={() => setEditing(true)}
              onDelete={() => void remove()}
            />

            {editing && isMine && (
              <div className="space-y-2 rounded-2xl border border-dashed border-border bg-card p-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void save()} disabled={saving}>
                    {saving ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
