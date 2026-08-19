"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  Shield, Image, Megaphone, Calendar, Headphones, BarChart3,
  Coins, Crown, Building2, Star, Radio, BadgeCheck, Trophy,
  Users, UserCog, Activity, RefreshCw, Lock,
} from "lucide-react"

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Shield, Image, Megaphone, Calendar, Headphones, BarChart3,
  Coins, Crown, Building2, Star, Radio, BadgeCheck, Trophy,
  Users, UserCog, Activity,
}

interface Section {
  key: string
  label: string
  description: string
  icon: string
  granted: boolean
}

export function TeamDashboard() {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/team/dashboard", {
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Access denied", description: data.error, variant: "destructive" })
        return
      }
      setSections(data.sections || [])
      setIsAdmin(data.is_admin || false)
      setUserName(data.user?.display_name || data.user?.username || "")
    } catch (err: any) {
      toast({ title: "Failed to load dashboard", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isAdmin ? "Admin Dashboard" : "Team Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Full admin access — all sections available"
              : `Welcome back, ${userName}. Here are your assigned sections.`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboard}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{sections.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Sections Accessible</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-400">
              {isAdmin ? "All" : sections.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Permissions</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              {isAdmin ? "Admin" : "Team"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Role</p>
          </CardContent>
        </Card>
      </div>

      {/* Sections Grid */}
      {sections.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium text-muted-foreground">No sections assigned</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ask an admin to grant you access to dashboard sections.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((section) => {
            const Icon = ICON_MAP[section.icon] || Shield
            return (
              <Card
                key={section.key}
                className="border-border hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{section.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{section.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
