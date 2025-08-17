"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, MapPin, Users, Plus, Clock, ExternalLink } from "lucide-react"
import { CreateEventModal } from "./create-event-modal"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface CircleEventsProps {
  circleId: string
  isAdmin?: boolean
}

export function CircleEvents({ circleId, isAdmin = false }: CircleEventsProps) {
  const [events, setEvents] = useState([])
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const supabase = createClient()

        const { data: eventsData, error } = await supabase
          .from("circle_events")
          .select(`
            *,
            host:profiles(*),
            attendees:circle_event_participants(count),
            user_attendance:circle_event_participants!inner(
              user_id,
              status
            )
          `)
          .eq("circle_id", circleId)
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true })

        if (error) {
          console.error("Error fetching events:", error)
          return
        }

        if (user) {
          const eventsWithAttendance = await Promise.all(
            (eventsData || []).map(async (event) => {
              const { data: attendanceData } = await supabase
                .from("circle_event_participants")
                .select("status")
                .eq("event_id", event.id)
                .eq("user_id", user.id)
                .single()

              return {
                ...event,
                is_attending: attendanceData?.status === "attending",
                attendee_count: event.attendees?.[0]?.count || 0,
              }
            }),
          )
          setEvents(eventsWithAttendance)
        } else {
          setEvents(
            (eventsData || []).map((event) => ({
              ...event,
              is_attending: false,
              attendee_count: event.attendees?.[0]?.count || 0,
            })),
          )
        }
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
      const supabase = createClient()

      if (currentlyAttending) {
        const { error } = await supabase
          .from("circle_event_participants")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id)

        if (error) throw error

        setEvents((prev) =>
          prev.map((event: any) =>
            event.id === eventId
              ? {
                  ...event,
                  is_attending: false,
                  attendee_count: Math.max(0, event.attendee_count - 1),
                }
              : event,
          ),
        )

        toast({ description: "RSVP cancelled successfully!" })
      } else {
        const { error } = await supabase.from("circle_event_participants").insert({
          event_id: eventId,
          user_id: user.id,
          status: "attending",
          created_at: new Date().toISOString(),
        })

        if (error) throw error

        setEvents((prev) =>
          prev.map((event: any) =>
            event.id === eventId
              ? {
                  ...event,
                  is_attending: true,
                  attendee_count: event.attendee_count + 1,
                }
              : event,
          ),
        )

        toast({ description: "RSVP confirmed! Event added to your calendar." })
      }
    } catch (error) {
      console.error("Error handling RSVP:", error)
      toast({
        title: "Error",
        description: "Failed to update RSVP. Please try again.",
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

  if (loading) {
    return <div className="flex justify-center p-8">Loading events...</div>
  }

  const upcomingEvents = events.filter((event: any) => isEventUpcoming(event.event_date))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center space-x-2">
          <Calendar className="w-6 h-6" />
          <span>Upcoming Events</span>
        </h2>
        {isAdmin && (
          <Button onClick={() => setShowCreateEvent(true)} className="bg-gradient-to-r from-purple-500 to-blue-500">
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {upcomingEvents.map((event: any) => (
          <Card key={event.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-semibold">{event.title}</h3>
                      {event.event_type && (
                        <Badge variant="outline" className="text-xs">
                          {event.event_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{event.description}</p>

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
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{getTimeUntilEvent(event.event_date)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatEventDate(event.event_date)}</span>
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
                      <div className="text-xs text-gray-500">Event Host</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
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
        ))}

        {upcomingEvents.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Upcoming Events</h3>
              <p className="text-gray-600 dark:text-gray-400">
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
