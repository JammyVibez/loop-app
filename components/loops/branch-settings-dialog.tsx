"use client"

import { useEffect, useState } from "react"
import { GitBranch, Users, Infinity as InfinityIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/components/ui/use-toast"
import { Spinner } from "@/components/ui/skeletons"
import { cn } from "@/lib/utils"

const DEPTH_PRESETS = [1, 3, 5, 10, 25]
const PER_USER_PRESETS = [1, 2, 5, 10, 25]

interface BranchSettingsDialogProps {
  loop: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (loop: any) => void
}

function toLimitString(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : ""
}

function LimitRow({
  icon,
  title,
  hint,
  value,
  onChange,
  presets,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  value: string
  onChange: (v: string) => void
  presets: number[]
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--theme-primary,#0ea5e9)]/12 text-[var(--theme-primary,#0ea5e9)]">
          {icon}
        </span>
        <div className="min-w-0">
          <Label className="text-sm font-semibold text-foreground">{title}</Label>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            value === ""
              ? "border-[var(--theme-primary,#0ea5e9)]/50 bg-[var(--theme-primary,#0ea5e9)]/15 text-[var(--theme-primary,#0ea5e9)]"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <InfinityIcon className="h-3.5 w-3.5" /> Unlimited
        </button>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(String(preset))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition",
              value === String(preset)
                ? "border-[var(--theme-primary,#0ea5e9)]/50 bg-[var(--theme-primary,#0ea5e9)]/15 text-[var(--theme-primary,#0ea5e9)]"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {preset}
          </button>
        ))}
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Custom"
          className="h-8 w-20 rounded-full px-3 text-xs tabular-nums"
        />
      </div>
    </div>
  )
}

/**
 * Lets a post's author decide how far their branch tree may grow and how many
 * branches one account may add to it. Blank / "Unlimited" clears the cap.
 */
export function BranchSettingsDialog({ loop, open, onOpenChange, onSaved }: BranchSettingsDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [depth, setDepth] = useState<string>(() => toLimitString(loop?.max_branch_depth))
  const [perUser, setPerUser] = useState<string>(() => toLimitString(loop?.max_branches_per_user))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDepth(toLimitString(loop?.max_branch_depth))
    setPerUser(toLimitString(loop?.max_branches_per_user))
  }, [open, loop?.id, loop?.max_branch_depth, loop?.max_branches_per_user])

  const parseLimit = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.floor(n)
  }

  const handleSave = async () => {
    if (!user?.id || user.id !== loop?.author_id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/loops/${loop.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token || user.token}`,
        },
        body: JSON.stringify({
          max_branch_depth: parseLimit(depth),
          max_branches_per_user: parseLimit(perUser),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Couldn't save branch settings")
      onSaved?.(data.loop)
      toast({ title: "Branch settings saved", description: "Applies to this post's whole tree." })
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Couldn't save branch settings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-border/70">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[var(--theme-primary,#0ea5e9)]" />
            Branch settings
          </DialogTitle>
          <DialogDescription>
            Control how your post&apos;s branch tree grows. Leave a limit on Unlimited to let it grow without stopping.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <LimitRow
            icon={<GitBranch className="h-4 w-4" />}
            title="Branch levels"
            hint="How deep other people can branch below this post."
            value={depth}
            onChange={setDepth}
            presets={DEPTH_PRESETS}
          />
          <LimitRow
            icon={<Users className="h-4 w-4" />}
            title="Branches per person"
            hint="How many branches one account can add to this post."
            value={perUser}
            onChange={setPerUser}
            presets={PER_USER_PRESETS}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="mr-2 h-4 w-4" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
