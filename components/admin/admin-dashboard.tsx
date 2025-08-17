"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Shield,
  Crown,
  Flag,
  Users,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  Target,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Mock data for admin dashboard
const verificationRequests = [
  {
    id: "1",
    user: {
      username: "techinfluencer",
      display_name: "Tech Influencer",
      avatar_url: "/placeholder.svg?height=40&width=40",
    },
    type: "influencer",
    reason: "I'm a tech content creator with 100K+ followers across platforms",
    socialLinks: "Instagram: @techinfluencer\nYouTube: TechInfluencer",
    submitted_at: new Date("2024-01-15"),
    status: "pending",
  },
  {
    id: "2",
    user: {
      username: "startupco",
      display_name: "Startup Company",
      avatar_url: "/placeholder.svg?height=40&width=40",
    },
    type: "root",
    reason: "Official account for our tech startup",
    socialLinks: "Website: https://startupco.com",
    submitted_at: new Date("2024-01-14"),
    status: "pending",
  },
]

const reportedContent = [
  {
    id: "1",
    content: {
      type: "loop",
      author: "spammer123",
      content: "This is spam content promoting fake products...",
      reported_by: 5,
    },
    reason: "Spam",
    status: "pending",
    reported_at: new Date("2024-01-15"),
  },
  {
    id: "2",
    content: {
      type: "comment",
      author: "trolluser",
      content: "Inappropriate comment with harassment...",
      reported_by: 3,
    },
    reason: "Harassment",
    status: "pending",
    reported_at: new Date("2024-01-14"),
  },
]

const premiumRequests = [
  {
    id: "1",
    user: {
      username: "creator123",
      display_name: "Content Creator",
      avatar_url: "/placeholder.svg?height=40&width=40",
    },
    plan: "annual",
    amount: "$99.99",
    status: "pending",
    requested_at: new Date("2024-01-15"),
  },
]

// Quest interfaces and state management
interface Quest {
  id: string
  title: string
  description: string
  type: "watch_ad" | "play_game" | "daily_login" | "weekly_bonus" | "social_share" | "invite_friend"
  reward_amount: number
  requirements?: any
  is_active: boolean
  created_at: string
  updated_at: string
  completion_count?: number
}

export function AdminDashboard() {
  const [verifications, setVerifications] = useState(verificationRequests)
  const [reports, setReports] = useState(reportedContent)
  const [premiums, setPremiums] = useState(premiumRequests)
  const [quests, setQuests] = useState<Quest[]>([])
  const [questDialogOpen, setQuestDialogOpen] = useState(false)
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [questForm, setQuestForm] = useState({
    title: "",
    description: "",
    type: "daily_login" as Quest["type"],
    reward_amount: 100,
    requirements: {},
    is_active: true,
  })

  // Fetch real data from API
  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch verification requests
      const verificationResponse = await fetch("/api/admin/verification")
      if (verificationResponse.ok) {
        const verificationData = await verificationResponse.json()
        setVerifications(verificationData.requests || [])
      }

      // Fetch premium requests
      const premiumResponse = await fetch("/api/admin/premium")
      if (premiumResponse.ok) {
        const premiumData = await premiumResponse.json()
        setPremiums(premiumData.requests || [])
      }

      const questResponse = await fetch("/api/admin/quests")
      if (questResponse.ok) {
        const questData = await questResponse.json()
        setQuests(questData.quests || [])
      }
    } catch (error) {
      console.error("Error fetching admin data:", error)
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Load data on component mount
  useEffect(() => {
    fetchData()
  }, [])

  const handleVerificationAction = async (id: string, action: "approve" | "reject", adminNotes?: string) => {
    try {
      const response = await fetch("/api/admin/verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: id,
          action: action === "approve" ? "approved" : "rejected",
          adminNotes: adminNotes || "",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to process verification request")
      }

      // Update local state
      setVerifications((prev) =>
        prev.map((req) => (req.id === id ? { ...req, status: action === "approve" ? "approved" : "rejected" } : req)),
      )

      toast({
        title: `Verification ${action === "approve" ? "Approved" : "Rejected"}`,
        description: `User verification request has been ${action}d.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process verification request",
        variant: "destructive",
      })
    }
  }

  const handleReportAction = (id: string, action: "dismiss" | "remove") => {
    setReports((prev) =>
      prev.map((report) =>
        report.id === id ? { ...report, status: action === "dismiss" ? "dismissed" : "removed" } : report,
      ),
    )

    toast({
      title: `Report ${action === "dismiss" ? "Dismissed" : "Content Removed"}`,
      description: `Report has been ${action}d.`,
    })
  }

  const handlePremiumAction = async (id: string, action: "approve" | "reject", adminNotes?: string) => {
    try {
      const response = await fetch("/api/admin/premium", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: id,
          action: action === "approve" ? "approved" : "rejected",
          adminNotes: adminNotes || "",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to process premium request")
      }

      // Update local state
      setPremiums((prev) =>
        prev.map((req) => (req.id === id ? { ...req, status: action === "approve" ? "approved" : "rejected" } : req)),
      )

      toast({
        title: `Premium ${action === "approve" ? "Approved" : "Rejected"}`,
        description: `Premium request has been ${action}d.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process premium request",
        variant: "destructive",
      })
    }
  }

  const handleCreateQuest = async () => {
    try {
      const response = await fetch("/api/admin/quests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(questForm),
      })

      if (!response.ok) {
        throw new Error("Failed to create quest")
      }

      const data = await response.json()
      setQuests((prev) => [...prev, data.quest])
      setQuestDialogOpen(false)
      resetQuestForm()

      toast({
        title: "Quest Created",
        description: "New quest has been created successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create quest",
        variant: "destructive",
      })
    }
  }

  const handleUpdateQuest = async () => {
    if (!editingQuest) return

    try {
      const response = await fetch(`/api/admin/quests/${editingQuest.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(questForm),
      })

      if (!response.ok) {
        throw new Error("Failed to update quest")
      }

      const data = await response.json()
      setQuests((prev) => prev.map((q) => (q.id === editingQuest.id ? data.quest : q)))
      setQuestDialogOpen(false)
      setEditingQuest(null)
      resetQuestForm()

      toast({
        title: "Quest Updated",
        description: "Quest has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update quest",
        variant: "destructive",
      })
    }
  }

  const handleDeleteQuest = async (questId: string) => {
    try {
      const response = await fetch(`/api/admin/quests/${questId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete quest")
      }

      setQuests((prev) => prev.filter((q) => q.id !== questId))

      toast({
        title: "Quest Deleted",
        description: "Quest has been deleted successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete quest",
        variant: "destructive",
      })
    }
  }

  const handleToggleQuestStatus = async (questId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/quests/${questId}/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !isActive }),
      })

      if (!response.ok) {
        throw new Error("Failed to toggle quest status")
      }

      setQuests((prev) => prev.map((q) => (q.id === questId ? { ...q, is_active: !isActive } : q)))

      toast({
        title: `Quest ${!isActive ? "Activated" : "Deactivated"}`,
        description: `Quest has been ${!isActive ? "activated" : "deactivated"} successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle quest status",
        variant: "destructive",
      })
    }
  }

  const resetQuestForm = () => {
    setQuestForm({
      title: "",
      description: "",
      type: "daily_login",
      reward_amount: 100,
      requirements: {},
      is_active: true,
    })
  }

  const openEditDialog = (quest: Quest) => {
    setEditingQuest(quest)
    setQuestForm({
      title: quest.title,
      description: quest.description,
      type: quest.type,
      reward_amount: quest.reward_amount,
      requirements: quest.requirements || {},
      is_active: quest.is_active,
    })
    setQuestDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Shield className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{verifications.filter((v) => v.status === "pending").length}</div>
            <div className="text-sm text-gray-600">Pending Verifications</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <Flag className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{reports.filter((r) => r.status === "pending").length}</div>
            <div className="text-sm text-gray-600">Pending Reports</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <Crown className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{premiums.filter((p) => p.status === "pending").length}</div>
            <div className="text-sm text-gray-600">Premium Requests</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <Users className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">1,234</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <Target className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{quests.filter((q) => q.is_active).length}</div>
            <div className="text-sm text-gray-600">Active Quests</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="verifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="verifications">Verifications</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
          <TabsTrigger value="quests">Quest Management</TabsTrigger>
        </TabsList>

        <TabsContent value="verifications">
          <Card>
            <CardHeader>
              <CardTitle>Verification Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {verifications.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={request.user.avatar_url || "/placeholder.svg"} />
                          <AvatarFallback>{request.user.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{request.user.display_name}</div>
                          <div className="text-sm text-gray-500">@{request.user.username}</div>
                        </div>
                        <Badge variant={request.type === "root" ? "default" : "secondary"}>
                          {request.type === "root" ? "🌱 Root" : "⭐ Influencer"}
                        </Badge>
                      </div>
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "default"
                            : request.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <strong>Reason:</strong> {request.reason}
                      </div>
                      <div>
                        <strong>Social Links:</strong> {request.socialLinks}
                      </div>
                    </div>

                    {request.status === "pending" && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleVerificationAction(request.id, "approve")}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleVerificationAction(request.id, "reject")}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reported Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <div>
                          <div className="font-semibold">
                            {report.content.type} by @{report.content.author}
                          </div>
                          <div className="text-sm text-gray-500">Reported by {report.content.reported_by} users</div>
                        </div>
                        <Badge variant="destructive">{report.reason}</Badge>
                      </div>
                      <Badge
                        variant={
                          report.status === "dismissed"
                            ? "secondary"
                            : report.status === "removed"
                              ? "destructive"
                              : "default"
                        }
                      >
                        {report.status}
                      </Badge>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      <strong>Content:</strong> {report.content.content}
                    </div>

                    {report.status === "pending" && (
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          View Full Content
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReportAction(report.id, "remove")}>
                          Remove Content
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReportAction(report.id, "dismiss")}>
                          Dismiss Report
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="premium">
          <Card>
            <CardHeader>
              <CardTitle>Premium Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {premiums.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={request.user.avatar_url || "/placeholder.svg"} />
                          <AvatarFallback>{request.user.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{request.user.display_name}</div>
                          <div className="text-sm text-gray-500">@{request.user.username}</div>
                        </div>
                        <Badge variant="secondary">
                          {request.plan} - {request.amount}
                        </Badge>
                      </div>
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "default"
                            : request.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>

                    {request.status === "pending" && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handlePremiumAction(request.id, "approve")}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handlePremiumAction(request.id, "reject")}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quests">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quest Management</CardTitle>
              <Dialog open={questDialogOpen} onOpenChange={setQuestDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingQuest(null)
                      resetQuestForm()
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Quest
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingQuest ? "Edit Quest" : "Create New Quest"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        value={questForm.title}
                        onChange={(e) => setQuestForm((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter quest title"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={questForm.description}
                        onChange={(e) => setQuestForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter quest description"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Type</label>
                      <Select
                        value={questForm.type}
                        onValueChange={(value) => setQuestForm((prev) => ({ ...prev, type: value as Quest["type"] }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily_login">Daily Login</SelectItem>
                          <SelectItem value="weekly_bonus">Weekly Bonus</SelectItem>
                          <SelectItem value="watch_ad">Watch Advertisement</SelectItem>
                          <SelectItem value="play_game">Play Mini-Game</SelectItem>
                          <SelectItem value="social_share">Social Share</SelectItem>
                          <SelectItem value="invite_friend">Invite Friend</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Reward Amount (Loop Coins)</label>
                      <Input
                        type="number"
                        value={questForm.reward_amount}
                        onChange={(e) =>
                          setQuestForm((prev) => ({ ...prev, reward_amount: Number.parseInt(e.target.value) || 0 }))
                        }
                        placeholder="Enter reward amount"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={questForm.is_active}
                        onChange={(e) => setQuestForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                      />
                      <label htmlFor="is_active" className="text-sm font-medium">
                        Active
                      </label>
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={editingQuest ? handleUpdateQuest : handleCreateQuest} className="flex-1">
                        {editingQuest ? "Update Quest" : "Create Quest"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setQuestDialogOpen(false)
                          setEditingQuest(null)
                          resetQuestForm()
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quests.map((quest) => (
                  <div key={quest.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Target className="w-5 h-5 text-orange-500" />
                        <div>
                          <div className="font-semibold">{quest.title}</div>
                          <div className="text-sm text-gray-500">{quest.description}</div>
                        </div>
                        <Badge variant={quest.is_active ? "default" : "secondary"}>
                          {quest.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">{quest.type.replace("_", " ").toUpperCase()}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          {quest.reward_amount} coins
                        </Badge>
                        {quest.completion_count && (
                          <Badge variant="outline">{quest.completion_count} completions</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(quest)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={quest.is_active ? "secondary" : "default"}
                        onClick={() => handleToggleQuestStatus(quest.id, quest.is_active)}
                      >
                        {quest.is_active ? (
                          <>
                            <Pause className="w-4 h-4 mr-1" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Activate
                          </>
                        )}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteQuest(quest.id)}>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {quests.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No quests created yet. Create your first quest to get started!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
