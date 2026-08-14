"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useLoginGate } from "@/hooks/use-login-gate"
import {
  Github,
  Globe,
  Linkedin,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react"

interface SkillRow {
  id?: string
  skill_name: string
  skill_level: "beginner" | "intermediate" | "advanced" | "expert"
  years_experience: number
}

interface Portfolio {
  id?: string
  title?: string | null
  description?: string | null
  website_url?: string | null
  github_url?: string | null
  linkedin_url?: string | null
  resume_url?: string | null
  skills?: string[]
  experience_years?: number
  hourly_rate?: number | null
  currency?: string | null
  is_available_for_hire?: boolean
}

const LEVELS: SkillRow["skill_level"][] = ["beginner", "intermediate", "advanced", "expert"]

export function DeveloperProfilePanel() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { requireAuth, LoginGateDialog } = useLoginGate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [newSkill, setNewSkill] = useState("")
  const [portfolio, setPortfolio] = useState<Portfolio>({})

  const loadProfile = async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch("/api/developers/profile", { headers: getAuthHeader(), cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load profile")
      setSkills(
        (data.skills || []).map((s: any) => ({
          id: s.id,
          skill_name: s.skill_name,
          skill_level: s.skill_level || "beginner",
          years_experience: Number(s.years_experience || 0),
        })),
      )
      setPortfolio(data.portfolio || {})
    } catch (err: any) {
      toast({ title: "Couldn't load developer profile", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    void loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const addSkill = () => {
    const name = newSkill.trim()
    if (!name) return
    if (skills.some((s) => s.skill_name.toLowerCase() === name.toLowerCase())) return
    setSkills((prev) => [...prev, { skill_name: name, skill_level: "intermediate", years_experience: 0 }])
    setNewSkill("")
  }

  const updateSkill = (index: number, patch: Partial<SkillRow>) => {
    setSkills((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const saveProfile = async () => {
    if (!requireAuth("post")) return
    setSaving(true)
    try {
      const res = await fetch("/api/developers/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          skills: skills.map((s) => ({
            skill_name: s.skill_name,
            skill_level: s.skill_level,
            years_experience: s.years_experience,
          })),
          skills_list: skills.map((s) => s.skill_name),
          title: portfolio.title || "",
          description: portfolio.description || "",
          website_url: portfolio.website_url || "",
          github_url: portfolio.github_url || "",
          linkedin_url: portfolio.linkedin_url || "",
          resume_url: portfolio.resume_url || "",
          experience_years: Number(portfolio.experience_years) || 0,
          hourly_rate: portfolio.hourly_rate ?? "",
          is_available_for_hire: Boolean(portfolio.is_available_for_hire),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save developer profile")
      setSkills(
        (data.skills || []).map((s: any) => ({
          id: s.id,
          skill_name: s.skill_name,
          skill_level: s.skill_level,
          years_experience: Number(s.years_experience || 0),
        })),
      )
      setPortfolio(data.portfolio || {})
      toast({ title: "Developer profile saved" })
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your developer profile…
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Sparkles className="h-8 w-8 text-cyan-500" />
          <p className="font-medium">Sign in to set up your developer profile</p>
          <p className="text-sm text-muted-foreground">
            Show off your skills, links, and availability to the Loop dev community.
          </p>
          <Button onClick={() => requireAuth("post")} className="rounded-full">
            Sign in
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {LoginGateDialog}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-5 w-5 text-cyan-500" /> Skills
            </CardTitle>
            <CardDescription>Pick the tech you work with — the community can find you by these.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add a skill (e.g. Supabase, Next.js, Flutter)…"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addSkill()
                  }
                }}
              />
              <Button variant="outline" onClick={addSkill} disabled={!newSkill.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {skills.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No skills yet — add your first one above.
              </p>
            ) : (
              <div className="space-y-2">
                {skills.map((skill, index) => (
                  <div
                    key={`${skill.skill_name}-${index}`}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Badge variant="secondary" className="truncate rounded-full">
                        {skill.skill_name}
                      </Badge>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setSkills((prev) => prev.filter((_, i) => i !== index))}
                        title="Remove skill"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={skill.skill_level}
                        onChange={(e) =>
                          updateSkill(index, { skill_level: e.target.value as SkillRow["skill_level"] })
                        }
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        {LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          value={skill.years_experience}
                          onChange={(e) =>
                            updateSkill(index, { years_experience: Number(e.target.value) || 0 })
                          }
                          className="h-8 w-16 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">yrs</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-indigo-500" /> Portfolio & availability
            </CardTitle>
            <CardDescription>Links and details shown on your developer profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dev-title">Headline</Label>
                <Input
                  id="dev-title"
                  placeholder="Full-stack developer building on Loop"
                  value={portfolio.title || ""}
                  onChange={(e) => setPortfolio((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dev-experience">Years of experience</Label>
                <Input
                  id="dev-experience"
                  type="number"
                  min={0}
                  max={60}
                  value={portfolio.experience_years ?? ""}
                  onChange={(e) =>
                    setPortfolio((p) => ({ ...p, experience_years: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dev-bio">Bio</Label>
              <Textarea
                id="dev-bio"
                placeholder="What do you build? What are you working on?"
                value={portfolio.description || ""}
                onChange={(e) => setPortfolio((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["github_url", "GitHub URL", Github],
                  ["linkedin_url", "LinkedIn URL", Linkedin],
                  ["website_url", "Website / portfolio", Globe],
                  ["resume_url", "Resume / CV URL", Globe],
                ] as const
              ).map(([field, label, Icon]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`dev-${field}`} className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
                  </Label>
                  <Input
                    id={`dev-${field}`}
                    placeholder="https://"
                    value={(portfolio as any)[field] || ""}
                    onChange={(e) => setPortfolio((p) => ({ ...p, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dev-rate">Hourly rate</Label>
                <Input
                  id="dev-rate"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={portfolio.hourly_rate ?? ""}
                  onChange={(e) =>
                    setPortfolio((p) => ({
                      ...p,
                      hourly_rate: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
                  <div>
                    <Label htmlFor="dev-hire">Available for hire</Label>
                    <p className="text-xs text-muted-foreground">
                      Turn this on to show an “Open to work” badge.
                    </p>
                  </div>
                  <Switch
                    id="dev-hire"
                    checked={Boolean(portfolio.is_available_for_hire)}
                    onCheckedChange={(checked) => setPortfolio((p) => ({ ...p, is_available_for_hire: checked }))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button
            onClick={() => void saveProfile()}
            disabled={saving}
            className="rounded-full px-6 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save developer profile
          </Button>
        </div>
      </div>
    </>
  )
}
