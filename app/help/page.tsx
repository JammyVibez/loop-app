"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Search,
  MessageCircle,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  HelpCircle,
  Book,
  Video,
  Users,
  Zap,
} from "lucide-react"

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  helpful: number
}

interface SupportTicket {
  id: string
  subject: string
  status: "open" | "in-progress" | "resolved"
  priority: "low" | "medium" | "high"
  createdAt: string
  lastUpdate: string
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [supportForm, setSupportForm] = useState({
    subject: "",
    category: "",
    message: "",
    priority: "medium",
  })
  const [tickets] = useState<SupportTicket[]>([
    {
      id: "T001",
      subject: "Unable to create new loop",
      status: "resolved",
      priority: "medium",
      createdAt: "2024-01-10",
      lastUpdate: "2024-01-12",
    },
    {
      id: "T002",
      subject: "Premium subscription billing issue",
      status: "in-progress",
      priority: "high",
      createdAt: "2024-01-15",
      lastUpdate: "2024-01-16",
    },
  ])

  const faqs: FAQ[] = [
    {
      id: "1",
      question: "How do I create my first loop?",
      answer:
        'To create your first loop, click the "Create Loop" button on your dashboard. Choose your content type (text, image, video, or code), add your content, and publish. You can also branch from existing loops to build on others\' ideas.',
      category: "getting-started",
      helpful: 45,
    },
    {
      id: "2",
      question: "What is branching and how does it work?",
      answer:
        "Branching allows you to create a new loop based on an existing one. When you branch, you're creating a connected piece of content that builds upon the original. This creates tree-like structures of related content.",
      category: "features",
      helpful: 38,
    },
    {
      id: "3",
      question: "How do I upgrade to Premium?",
      answer:
        "You can upgrade to Premium by going to Settings > Premium or clicking the Premium badge in the header. Choose your plan and complete the payment process. Premium features will be activated immediately.",
      category: "premium",
      helpful: 29,
    },
    {
      id: "4",
      question: "Can I delete or edit my loops?",
      answer:
        "Yes, you can edit your loops by clicking the edit button on your loop. However, if others have branched from your loop, some restrictions may apply to maintain the integrity of the tree structure.",
      category: "content",
      helpful: 33,
    },
    {
      id: "5",
      question: "How do Loop Circles work?",
      answer:
        "Loop Circles are communities where users can collaborate on specific topics. You can join circles, participate in discussions, attend events, and collaborate on shared projects.",
      category: "community",
      helpful: 27,
    },
    {
      id: "6",
      question: "What are Loop Coins and how do I earn them?",
      answer:
        "Loop Coins are our virtual currency earned through engagement. You earn coins by creating popular content, receiving likes, comments, and having your loops branched. Use coins in the Loop Shop for themes and features.",
      category: "rewards",
      helpful: 41,
    },
  ]

  const filteredFAQs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: supportForm.subject,
          category: supportForm.category,
          message: supportForm.message,
          priority: supportForm.priority,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit support ticket')
      }

      // Show success message
      alert('Support ticket submitted successfully! You will receive a response within 24 hours.')
      
      // Reset form
      setSupportForm({
        subject: "",
        category: "",
        message: "",
        priority: "medium",
      })
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to submit support ticket')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800"
      case "in-progress":
        return "bg-yellow-100 text-yellow-800"
      case "resolved":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-orange-100 text-orange-800"
      case "low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Help & Support Center</h1>
          <p className="text-muted-foreground text-lg">
            Find answers to your questions or get in touch with our support team
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Book className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Getting Started</h3>
              <p className="text-sm text-muted-foreground">Learn the basics</p>
            </CardContent>
          </Card>
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Video className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Video Tutorials</h3>
              <p className="text-sm text-muted-foreground">Watch and learn</p>
            </CardContent>
          </Card>
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Users className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Community</h3>
              <p className="text-sm text-muted-foreground">Connect with users</p>
            </CardContent>
          </Card>
          <Card className="text-center hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Zap className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Feature Requests</h3>
              <p className="text-sm text-muted-foreground">Suggest improvements</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="faq" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="contact">Contact Support</TabsTrigger>
            <TabsTrigger value="tickets">My Tickets</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="mt-6">
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search frequently asked questions..."
                  className="pl-10"
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {filteredFAQs.map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id}>
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-3">
                          <span>{faq.question}</span>
                          <Badge variant="outline" className="text-xs">
                            {faq.helpful} helpful
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pt-2">
                          <p className="text-muted-foreground mb-4">{faq.answer}</p>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm">
                              👍 Helpful
                            </Button>
                            <Button variant="outline" size="sm">
                              👎 Not helpful
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Support Tab */}
          <TabsContent value="contact" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Submit a Support Ticket
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSupportSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Subject</label>
                      <Input
                        value={supportForm.subject}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, subject: e.target.value }))}
                        placeholder="Brief description of your issue"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <select
                        value={supportForm.category}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, category: e.target.value }))}
                        className="w-full p-2 border rounded-md"
                        required
                      >
                        <option value="">Select a category</option>
                        <option value="technical">Technical Issue</option>
                        <option value="billing">Billing & Payments</option>
                        <option value="account">Account Management</option>
                        <option value="feature">Feature Request</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Priority</label>
                      <select
                        value={supportForm.priority}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, priority: e.target.value }))}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Message</label>
                      <Textarea
                        value={supportForm.message}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, message: e.target.value }))}
                        placeholder="Please provide detailed information about your issue..."
                        rows={5}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      Submit Ticket
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Other Ways to Reach Us</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Email Support</p>
                      <p className="text-sm text-muted-foreground">support@loop.com</p>
                      <p className="text-xs text-muted-foreground">Response within 24 hours</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Phone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Phone Support</p>
                      <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                      <p className="text-xs text-muted-foreground">Mon-Fri, 9AM-6PM EST</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Live Chat</p>
                      <p className="text-sm text-muted-foreground">Available 24/7</p>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => window.open('/support/chat', '_blank', 'width=400,height=600')}
                      >
                        Start Chat
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* My Tickets Tab */}
          <TabsContent value="tickets" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Support Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No support tickets</h3>
                    <p className="text-muted-foreground">You haven't submitted any support tickets yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{ticket.subject}</h3>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                            <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Ticket #{ticket.id}</span>
                          <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                          <span>Last update: {new Date(ticket.lastUpdate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Guide</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Complete guide to using all Loop features</p>
                  <Button variant="outline" className="w-full">
                    Read Guide
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Video Tutorials</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Step-by-step video tutorials for beginners</p>
                  <Button variant="outline" className="w-full">
                    Watch Videos
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">API Documentation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Technical documentation for developers</p>
                  <Button variant="outline" className="w-full">
                    View Docs
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Community Forum</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Connect with other Loop users</p>
                  <Button variant="outline" className="w-full">
                    Join Forum
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Feature Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Stay updated with latest features</p>
                  <Button variant="outline" className="w-full">
                    View Updates
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Best Practices</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">Tips for creating engaging content</p>
                  <Button variant="outline" className="w-full">
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
