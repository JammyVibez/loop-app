"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

const categories = [
  "Art",
  "Music",
  "Writing",
  "Photography",
  "Technology",
  "Philosophy",
  "Science",
  "Gaming",
  "Fitness",
  "Cooking",
  "Other",
]

export function CreateCircleButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    is_private: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { user, getAuthHeader } = useAuth()

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.description.trim() || !formData.category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to create a circle.", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/circles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(formData),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create circle")
      }

      toast({
        title: "Circle Created!",
        description: `${formData.name} has been created successfully.`,
      })

      setIsOpen(false)
      setFormData({ name: "", description: "", category: "", is_private: false })
      router.push(`/circles/${data.circle.id}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create circle. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Create Circle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span>Create New Circle</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="circle-name">Circle Name *</Label>
            <Input
              id="circle-name"
              placeholder="Enter circle name..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="circle-description">Description *</Label>
            <Textarea
              id="circle-description"
              placeholder="Describe what your circle is about..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-2 min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="circle-category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="private-circle">Private Circle</Label>
              <p className="text-sm text-gray-500">Require approval to join</p>
            </div>
            <Switch
              id="private-circle"
              checked={formData.is_private}
              onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked })}
            />
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
            >
              {isSubmitting ? "Creating..." : "Create Circle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
