"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, HardDrive, RefreshCw, Trash2, Users } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/skeletons"

type StorageUser = {
  user_id: string | null
  username: string | null
  display_name: string | null
  media_count: number
  total_bytes: number
  last_upload: string | null
}

type Disk = { usedPercent: number; freeBytes: number; totalBytes: number; available: boolean; root: string }

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`
}

/** Admin → Media → Storage: who is using the uploads volume, and how much. */
export function MediaStoragePanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<StorageUser[]>([])
  const [disk, setDisk] = useState<Disk | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/media/storage?limit=200", { headers: getAuthHeader(), cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load storage usage")
      setUsers(data.users || [])
      setDisk(data.disk || null)
      setTotal(data.total_bytes || 0)
    } catch (error: any) {
      toast({ title: "Storage usage unavailable", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, toast])

  useEffect(() => {
    void load()
  }, [load])

  const removeUserMedia = async (user: StorageUser) => {
    if (!user.user_id) return
    const proceed = await confirmDialog({
      title: "Delete all of this account's media?",
      description: `${user.media_count} files (${formatBytes(user.total_bytes)}) will be removed from the server. Posts that use them will show missing media.`,
      confirmLabel: "Delete media",
      destructive: true,
    })
    if (!proceed) return

    setBusyId(user.user_id)
    try {
      const res = await fetch(`/api/admin/media/storage?user_id=${encodeURIComponent(user.user_id)}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast({ title: `${data.deleted || 0} files deleted`, description: `@${user.username || user.user_id}` })
      await load()
    } catch (error: any) {
      toast({ title: "Could not delete media", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Storage by account
            </CardTitle>
            <CardDescription>
              Every VPS-stored file counted against its owner. Deleting an account's media frees the space immediately
              and is written to the audit log file by file.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/20 p-3 text-xs">
          <span className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            {disk?.available ? `${disk.usedPercent}% of the volume used · ${formatBytes(disk.freeBytes)} free` : "Disk usage unavailable"}
          </span>
          <Badge variant="outline">{formatBytes(total)} tracked</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !users.length ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : !users.length ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No VPS uploads recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.user_id || "unknown"} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user.username ? `@${user.username}` : user.display_name || user.user_id || "Unknown account"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {user.media_count} files · {formatBytes(user.total_bytes)}
                    {user.last_upload ? ` · last upload ${new Date(user.last_upload).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="hidden w-40 sm:block">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${total ? Math.min(100, (user.total_bytes / total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
                {user.user_id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    disabled={busyId === user.user_id}
                    onClick={() => removeUserMedia(user)}
                  >
                    {busyId === user.user_id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {!disk?.available ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-amber-600">
            <AlertTriangle className="h-4 w-4" /> Check MEDIA_STORAGE_ROOT on the server — the uploads volume could not
            be read.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
