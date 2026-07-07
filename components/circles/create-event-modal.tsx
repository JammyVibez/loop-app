"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Calendar, MapPin, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  circleId: string
  onEventCreated: (event: any) => void
}

export function CreateEventModal({ isOpen, onClose, circleId, onEventCreated }: CreateEventModalProps) {
  const [eventData, setEventData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    isVirtual: false,
    maxAttendees: "",
    requiresApproval: false,
  })
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()
  const { user, getAuthHeader } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to create events.", variant: "destructive" })
      return
    }

    setIsCreating(true)
    try {
      const startsAt = new Date(`${eventData.date}T${eventData.time}`).toISOString()
      const response = await fetch(`/api/circles/${circleId}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          title: eventData.title,
          description: eventData.description,
          event_type: eventData.isVirtual ? "voice_chat" : "discussion",
          starts_at: startsAt,
          ends_at: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
          max_participants: eventData.maxAttendees ? Number.parseInt(eventData.maxAttendees) : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create event")

      onEventCreated(data.event)
      toast({ title: "Event Created!", description: "Your event has been created and members will be notified." })
      setEventData({ title: "", description: "", date: "", time: "", location: "", isVirtual: false, maxAttendees: "", requiresApproval: false })
      onClose()
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to create event.", variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Create New Event</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={eventData.title}
              onChange={(e) => setEventData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Loop Creators Meetup"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={eventData.description}
              onChange={(e) => setEventData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this event is about..."
              rows={3}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={eventData.date}
                onChange={(e) => setEventData((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time *</Label>
              <Input
                id="time"
                type="time"
                value={eventData.time}
                onChange={(e) => setEventData((prev) => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isVirtual"
                checked={eventData.isVirtual}
                onCheckedChange={(checked) => setEventData((prev) => ({ ...prev, isVirtual: checked }))}
              />
              <Label htmlFor="isVirtual">Virtual Event</Label>
            </div>

            {!eventData.isVirtual && (
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="location"
                    value={eventData.location}
                    onChange={(e) => setEventData((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Enter event location"
                    className="pl-10"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxAttendees">Maximum Attendees (Optional)</Label>
            <div className="relative">
              <Users className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                id="maxAttendees"
                type="number"
                value={eventData.maxAttendees}
                onChange={(e) => setEventData((prev) => ({ ...prev, maxAttendees: e.target.value }))}
                placeholder="Leave empty for unlimited"
                className="pl-10"
                min="1"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="requiresApproval"
              checked={eventData.requiresApproval}
              onCheckedChange={(checked) => setEventData((prev) => ({ ...prev, requiresApproval: checked }))}
            />
            <Label htmlFor="requiresApproval">Require approval for attendance</Label>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="submit" disabled={isCreating} className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500">
              {isCreating ? "Creating..." : "Create Event"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
