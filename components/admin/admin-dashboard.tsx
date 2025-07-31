"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Shield, Crown, Flag, Users, CheckCircle, XCircle, Eye, AlertTriangle } from "lucide-react"
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

export function AdminDashboard() {
  const [verifications, setVerifications] = useState(verificationRequests)
  const [reports, setReports] = useState(reportedContent)
  const [premiums, setPremiums] = useState(premiumRequests)
  const { toast } = useToast()

  const handleVerificationAction = (id: string, action: "approve" | "reject") => {
    setVerifications((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: action === "approve" ? "approved" : "rejected" } : req)),
    )

    toast({
      title: `Verification ${action === "approve" ? "Approved" : "Rejected"}`,
      description: `User verification request has been ${action}d.`,
    })
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

  const handlePremiumAction = (id: string, action: "approve" | "reject") => {
    setPremiums((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: action === "approve" ? "approved" : "rejected" } : req)),
    )

    toast({
      title: `Premium ${action === "approve" ? "Approved" : "Rejected"}`,
      description: `Premium request has been ${action}d.`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      <Tabs defaultValue="verifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="verifications">Verifications</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
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
      </Tabs>
    </div>
  )
}
