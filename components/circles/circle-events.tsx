"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, MapPin, Users, Plus, Clock, ExternalLink, Flame, Share2 } from "lucide-react"
import { absoluteAppUrl, shareContent } from "@/lib/share"
import { CreateEventModal } from "./create-event-modal"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getEventStatus, formatEventTime, getEventStatusBadge } from "@/lib/events"
import { useLiveEventTimer } from "@/hooks/use-events-state"

interface CircleEventsProps {
  circleId: string
  isAdmin?: boolean
}

export function CircleEvents({ circleId, isAdmin = false }: CircleEventsProps) {
  const [events, setEvents] = useState<any[]>([])
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { checkStatus } = useLiveEventTimer(15000)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Real API — matches the columns the create/update/delete routes
        // actually use (starts_at/organizer_id), instead of querying
        // Supabase directly for event_date/host_id, which never existed on
        // circle_events, and a circle_event_participants table that didn't
        // exist at all (so every fetch here silently errored and RSVPs were
        // never actually saved anywhere).
        const response = await fetch(`/api/circles/${circleId}/events?status=upcoming`, {
          headers: getAuthHeader(),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          console.error("Error fetching events:", data.error)
          setEvents([])
          return
        }

        const eventsData = data.events || []
        const eventsWithAttendance = await Promise.all(
          eventsData.map(async (event: any) => {
            try {
              const attRes = await fetch(`/api/circles/${circleId}/events/${event.id}/participants`, {
                headers: getAuthHeader(),
              })
              const attData = await attRes.json().catch(() => ({}))
              return {
                ...event,
                host: event.organizer,
                is_attending: Boolean(attData.is_attending),
                attendee_count: attData.attendee_count ?? event.participant_count ?? 0,
              }
            } catch {
              return { ...event, host: event.organizer, is_attending: false, attendee_count: event.participant_count ?? 0 }
            }
          }),
        )
        setEvents(eventsWithAttendance)
      } catch (error) {
        console.error("Error fetching events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [circleId, user])

  const handleRSVP = async (eventId: string, currentlyAttending: boolean) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to RSVP to events.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/circles/${circleId}/events/${eventId}/participants`, {
        method: currentlyAttending ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to update RSVP")

      setEvents((prev) =>
        prev.map((event: any) =>
          event.id === eventId
            ? {
                ...event,
                is_attending: !currentlyAttending,
                attendee_count: Math.max(0, event.attendee_count + (currentlyAttending ? -1 : 1)),
              }
            : event,
        ),
      )

      toast({ description: currentlyAttending ? "RSVP cancelled successfully!" : "RSVP confirmed! Event added to your calendar." })
    } catch (error: any) {
      console.error("Error handling RSVP:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to update RSVP. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTimeUntilEvent = (dateString: string) => {
    const now = new Date()
    const eventDate = new Date(dateString)
    const diff = eventDate.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `in ${days} day${days > 1 ? "s" : ""}`
    if (hours > 0) return `in ${hours} hour${hours > 1 ? "s" : ""}`
    return "starting soon"
  }

  const isEventUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date()
  }

  const handleEventCreated = (newEvent: any) => {
    setEvents((prev) => [newEvent, ...prev])
    setShowCreateEvent(false)
    toast({ description: "Event created successfully!" })
  }

  const handleShareEvent = async (event: any) => {
    const result = await shareContent({
      url: absoluteAppUrl(`/circles/${circleId}?tab=events&event=${event.id}`),
      title: event.title || "Circle event on Loop",
      text: event.description?.slice(0, 140) || `Join ${event.title} on Loop`,
    })
    if (result === "copied") {
      toast({ title: "Link copied", description: "Event link is on your clipboard." })
    } else if (result === "failed") {
      toast({ title: "Couldn't share", variant: "destructive" })
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading events...</div>
  }

  const activeEvents = events
    .map((event: any) => ({
      ...event,
      derivedStatus: checkStatus(event),
    }))
    .filter((event: any) => event.derivedStatus !== "ended")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center space-x-2">
          <Calendar className="w-6 h-6 text-primary" />
          <span>Circle Events Stage</span>
        </h2>
        {isAdmin && (
          <Button onClick={() => setShowCreateEvent(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {activeEvents.map((event: any) => {
          const badgeConfig = getEventStatusBadge(event.derivedStatus)
          const formattedTime = formatEventTime(event.starts_at, event.derivedStatus)

          return (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={`${badgeConfig.className} text-xs px-2.5 py-0.5 flex items-center gap-1`}>
                          {badgeConfig.dot && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
                          {badgeConfig.label}
                        </Badge>
                        <h3 className="text-xl font-semibold">{event.title}</h3>
                        {event.event_type && (
                          <Badge variant="outline" className="text-xs">
                            {event.event_type}
                          </Badge>
                        )}
                      </div>
                    <p className="text-muted-foreground mb-3">{event.description}</p>

                    {/* Event Tags */}
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {event.tags.map((tag: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <Badge
                      variant={event.is_attending ? "default" : "outline"}
                      className={event.is_attending ? "bg-green-500" : ""}
                    >
                      {event.is_attending ? "Attending" : "Not Attending"}
                    </Badge>
                    <div className="flex items-center space-x-1 text-xs text-muted-foreground font-medium">
                      <Clock className="w-3 h-3 text-primary" />
                      <span>{formattedTime}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatEventDate(event.starts_at)}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>
                      {event.attendee_count} attending
                      {event.max_participants && ` / ${event.max_participants}`}
                    </span>
                  </div>
                </div>

                {/* Event Link */}
                {event.event_link && (
                  <div className="flex items-center space-x-2 text-sm">
                    <ExternalLink className="w-4 h-4 text-blue-500" />
                    <a
                      href={event.event_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 underline"
                    >
                      Join Event Link
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={event.host?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{event.host?.display_name?.charAt(0) || "H"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{event.host?.display_name || "Event Host"}</div>
                      <div className="text-xs text-muted-foreground">Event Host</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleShareEvent(event)} aria-label="Share event">
                      <Share2 className="w-4 h-4 mr-1" />
                      Share
                    </Button>
                    {event.event_link && event.is_attending && (
                      <Button variant="outline" size="sm" onClick={() => window.open(event.event_link, "_blank")}>
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Join
                      </Button>
                    )}
                    <Button
                      onClick={() => handleRSVP(event.id, event.is_attending)}
                      variant={event.is_attending ? "outline" : "default"}
                      disabled={
                        event.max_participants && event.attendee_count >= event.max_participants && !event.is_attending
                      }
                    >
                      {event.is_attending ? "Cancel RSVP" : "RSVP"}
                    </Button>
                  </div>
                </div>

                {/* Event Full Notice */}
                {event.max_participants && event.attendee_count >= event.max_participants && !event.is_attending && (
                  <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                      This event is full. Join the waitlist to be notified if spots open up.
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

        {activeEvents.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Upcoming Events</h3>
              <p className="text-muted-foreground">
                {isAdmin ? "Create the first event for this circle!" : "Check back later for new events."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateEventModal
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        circleId={circleId}
        onEventCreated={handleEventCreated}
      />
    </div>
  )
}
