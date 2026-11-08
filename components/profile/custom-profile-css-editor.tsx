"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Code2, Crown, ExternalLink, Lock, RotateCcw, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { MAX_PROFILE_CUSTOM_CSS_BYTES, profileCustomCssByteLength } from "@/lib/profile-custom-css-limits"

export function CustomProfileCssEditor({ initialCss = "" }: { initialCss?: string | null }) {
  const { user, getAuthHeader, applyServerProfile, refreshUser } = useAuth()
  const { toast } = useToast()
  const [css, setCss] = useState(initialCss || "")
  const [savedCss, setSavedCss] = useState(initialCss || "")
  const [saving, setSaving] = useState(false)
  const byteLength = useMemo(() => profileCustomCssByteLength(css), [css])
  const tooLarge = byteLength > MAX_PROFILE_CUSTOM_CSS_BYTES
  const isDirty = css !== savedCss

  useEffect(() => {
    const next = initialCss || ""
    setCss(next)
    setSavedCss(next)
  }, [initialCss])

  const save = async () => {
    if (!user || !user.is_premium || tooLarge || !isDirty || saving) return
    setSaving(true)
    try {
      const response = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ custom_profile_css: css }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 403 && data.pro_required) {
          throw new Error("Your Loop Pro membership is required to save custom CSS.")
        }
        throw new Error(data.error || "Could not save custom profile CSS.")
      }
      const saved = typeof data.profile?.custom_profile_css === "string"
        ? data.profile.custom_profile_css
        : css
      setCss(saved)
      setSavedCss(saved)
      applyServerProfile({ custom_profile_css: saved })
      await refreshUser()
      toast({ title: "Profile CSS saved", description: "Your profile styling is now live." })
    } catch (error) {
      toast({
        title: "Could not save CSS",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!user?.is_premium) {
    return (
      <Card className="overflow-hidden border-amber-500/25">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              Custom profile CSS
            </CardTitle>
            <Badge variant="outline" className="border-amber-500/40 text-amber-600">
              <Crown className="mr-1 h-3 w-3" /> Pro
            </Badge>
          </div>
          <CardDescription>
            Make your profile feel like yours with a full custom stylesheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Unlock up to 21,000 bytes of profile-scoped CSS with a Loop Pro subscription.
          </p>
          <Button asChild className="rounded-full">
            <Link href="/premium?plan=monthly">
              <Crown className="mr-2 h-4 w-4" />
              Unlock Pro · $3.99/month
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            Custom profile CSS
            <Badge variant="secondary">Pro</Badge>
          </CardTitle>
          <Link
            href={"/profile/" + encodeURIComponent(user.username)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View profile <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        <CardDescription>
          Write CSS for your public profile. Selectors are automatically scoped to your profile, so they cannot restyle the rest of Loop.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          id="custom-profile-css"
          value={css}
          onChange={(event) => setCss(event.target.value)}
          rows={16}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-[320px] resize-y font-mono text-xs leading-5"
          placeholder={":root {\n  --profile-accent: #9b8cff;\n}\n\nh1 {\n  letter-spacing: -0.04em;\n}\n\na:hover {\n  color: var(--profile-accent);\n}"}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={tooLarge ? "text-xs tabular-nums text-destructive" : "text-xs tabular-nums text-muted-foreground"} aria-live="polite">
            {byteLength.toLocaleString()} / {MAX_PROFILE_CUSTOM_CSS_BYTES.toLocaleString()} bytes
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!isDirty || saving}
              onClick={() => setCss(savedCss)}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={!isDirty || tooLarge || saving}
              onClick={() => void save()}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save CSS"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          External URLs, @import and remote font loading are blocked to protect profile visitors. The limit is 21,000 UTF-8 bytes.
        </p>
      </CardContent>
    </Card>
  )
}
