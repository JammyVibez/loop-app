"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Shield, Star, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

export function VerificationRequest() {
  const [formData, setFormData] = useState({
    realName: "",
    username: "",
    socialLinks: "",
    reason: "",
    category: "influencer" as "influencer" | "root",
    documents: null as File | null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/verification/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          realName: formData.realName,
          username: formData.username,
          socialLinks: formData.socialLinks,
          reason: formData.reason,
          verificationType: formData.category,
          documents: formData.documents?.name || null, // In real app, upload file first
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit verification request')
      }

      toast({
        title: "Verification Request Submitted!",
        description: "We'll review your application within 3-5 business days.",
      })

      // Reset form
      setFormData({
        realName: "",
        username: "",
        socialLinks: "",
        reason: "",
        category: "influencer",
        documents: null,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit verification request",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, documents: file }))
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold">Get Verified on Loop</h1>
        <p className="text-gray-600 dark:text-gray-400">Join verified creators and build trust with your audience</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <Star className="w-8 h-8 text-blue-500 mx-auto" />
            <h3 className="font-semibold">Influencer Verification</h3>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              ⭐ Blue Checkmark
            </Badge>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              For content creators, public figures, and notable accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
            <h3 className="font-semibold">Root Verification</h3>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              🌱 Green Badge
            </Badge>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              For organizations, businesses, and official accounts
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verification Application</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="realName">Real Name *</Label>
                <Input
                  id="realName"
                  value={formData.realName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, realName: e.target.value }))}
                  placeholder="Your full legal name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="@yourusername"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Verification Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    value="influencer"
                    checked={formData.category === "influencer"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value as "influencer" }))}
                  />
                  <span>Influencer (⭐)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    value="root"
                    checked={formData.category === "root"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value as "root" }))}
                  />
                  <span>Root/Organization (🌱)</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="socialLinks">Social Media Links</Label>
              <Textarea
                id="socialLinks"
                value={formData.socialLinks}
                onChange={(e) => setFormData((prev) => ({ ...prev, socialLinks: e.target.value }))}
                placeholder="Instagram: @username&#10;Twitter: @username&#10;Website: https://..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Why should you be verified? *</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Explain your public interest, notable achievements, or why verification would benefit the community..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documents">Supporting Documents (Optional)</Label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <input
                  type="file"
                  id="documents"
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                />
                <label htmlFor="documents" className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-500">Upload documents</span>
                  <p className="text-sm text-gray-500 mt-1">
                    ID, business license, press articles, etc. (PDF, JPG, PNG)
                  </p>
                </label>
                {formData.documents && <p className="text-sm text-green-600 mt-2">✓ {formData.documents.name}</p>}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500"
            >
              {isSubmitting ? "Submitting..." : "Submit Verification Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
