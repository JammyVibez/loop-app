"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { TeamDashboard } from "@/components/team/team-dashboard"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function TeamPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const isAdmin = user?.is_admin || user?.email === "useehamza0@gmail.com"
  const isTeam = user?.is_team_member || isAdmin

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth?returnTo=/team")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  if (!isTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold">Access Restricted</h1>
            <p className="text-sm text-muted-foreground">
              The Team Dashboard is only available to team members. Contact an admin to request access.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <TeamDashboard />
}
