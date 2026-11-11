"use client"

import { useEffect, useState } from "react"
import { HardDrive, Save, ShieldCheck } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { MEDIA_POLICY_FIELDS, type MediaPolicy } from "@/lib/media/policy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/skeletons"

type DiskInfo = {
  root: string
  usedPercent: number
  freeBytes: number
  totalBytes: number
  available: boolean
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`
}

/**
 * Admin → Media → Upload rules.
 *
 * Every limit the upload service enforces lives here, so the numbers can be
 * changed during a launch (or during an abuse wave) without a redeploy. Saving
 * refreshes the server-side cache immediately.
 */
export function MediaPolicyPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [policy, setPolicy] = useState<MediaPolicy | null>(null)
  const [disk, setDisk] = useState<DiskInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/media/policy", { headers: getAuthHeader(), cache: "no-store" })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load upload rules")
        setPolicy(data.policy)
        setDisk(data.disk)
      } catch (error: any) {
        toast({ title: "Could not load upload rules", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (!policy) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/media/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ policy }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setPolicy(data.policy)
      toast({ title: "Upload rules saved", description: "New limits apply to the next upload." })
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !policy) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const groups = Array.from(new Set(MEDIA_POLICY_FIELDS.map((field) => field.group)))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Media upload rules
          </CardTitle>
          <CardDescription>
            Enforced on the server for every upload. The per-file ceiling applies to admins too; only regular users are
            subject to the quota, daily byte cap and hourly count. Disk safety blocks every account at the threshold
            below so a full disk can never crash the VPS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Uploads volume</p>
                <p className="text-xs text-muted-foreground">
                  {disk?.available
                    ? `${formatBytes(disk.freeBytes)} free of ${formatBytes(disk.totalBytes)} · ${disk.root}`
                    : "Disk usage unavailable — check MEDIA_STORAGE_ROOT on the server."}
                </p>
              </div>
            </div>
            {disk?.available ? (
              <div className="min-w-[160px]">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      disk.usedPercent >= (policy?.disk_block_percent ?? 90)
                        ? "bg-red-500"
                        : disk.usedPercent >= (policy?.disk_warn_percent ?? 80)
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, disk.usedPercent)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-muted-foreground">{disk.usedPercent}% used</p>
              </div>
            ) : null}
          </div>

          {groups.map((group) => (
            <div key={group} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{group}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MEDIA_POLICY_FIELDS.filter((field) => field.group === group).map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={field.key} className="text-xs">
                      {field.label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={field.key}
                        type="number"
                        min={0}
                        value={policy[field.key]}
                        onChange={(event) =>
                          setPolicy((prev) =>
                            prev ? { ...prev, [field.key]: Number(event.target.value) } : prev,
                          )
                        }
                      />
                      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{field.unit}</span>
                    </div>
                    {field.hint ? <p className="text-[11px] text-muted-foreground">{field.hint}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Save upload rules
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
