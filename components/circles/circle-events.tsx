"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, MapPin, Users, Plus } from "lucide-react"
import { CreateEventModal } from "./create-event-modal"

interface Event {
  id: string
  title: string
  description: string
  date: Date
  location?: string
  host: {
    username: string
    display_name: string
    avatar_url: string
  }
  attendees: number
  max_attendees?: number
  is_attending: boolean
}

const mockEvents: Event[] = [
  {
    id: "1",
    title: "Loop Creators Meetup",
    description: "Join us for an evening of networking and sharing creative ideas!",
    date: new Date("2024-02-15T18:00:00"),
    location: "San Francisco, CA",
    host: {
      username: "eventhost",
      display_name: "Event Host",
      avatar_url: "/placeholder.svg?height=32&width=32",
    },
    attendees: 23,
    max_attendees: 50,
    is_attending: false,
  },
  {
    id: "2",
    title: "Virtual Loop Workshop",
    description: "Learn advanced Loop tree techniques and branching strategies",
    date: new Date("2024-02-20T15:00:00"),
    host: {
      username: "workshopleader",
      display_name: "Workshop Leader",
      avatar_url: "/placeholder.svg?height=32&width=32",
    },
    attendees: 156,
    is_attending: true,
  },
]

interface CircleEventsProps {
  circleId: string
  isAdmin?: boolean
}

export function CircleEvents({ circleId, isAdmin = false }: CircleEventsProps) {
  const [events, setEvents] = useState(mockEvents)
  const [showCreateEvent, setShowCreateEvent] = useState(false)

  const handleRSVP = (eventId: string) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? {
              ...event,
              is_attending: !event.is_attending,
              attendees: event.is_attending ? event.attendees - 1 : event.attendees + 1,
            }
          : event,
      ),
    )
  }

  const formatEventDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const isEventUpcoming = (date: Date) => {
    return date > new Date()
  }

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
        {events
          .filter((event) => isEventUpcoming(event.date))
          .map((event) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-3">{event.description}</p>
                    </div>
                    <Badge
                      variant={event.is_attending ? "default" : "outline"}
                      className={event.is_attending ? "bg-green-500" : ""}
                    >
                      {event.is_attending ? "Attending" : "Not Attending"}
                    </Badge>
                  </div>

                  <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatEventDate(event.date)}</span>
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
                        {event.attendees} attending
                        {event.max_attendees && ` / ${event.max_attendees}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={event.host.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{event.host.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{event.host.display_name}</div>
                        <div className="text-xs text-gray-500">Event Host</div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleRSVP(event.id)}
                      variant={event.is_attending ? "outline" : "default"}
                      disabled={event.max_attendees && event.attendees >= event.max_attendees && !event.is_attending}
                    >
                      {event.is_attending ? "Cancel RSVP" : "RSVP"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {events.filter((event) => isEventUpcoming(event.date)).length === 0 && (
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
        onEventCreated={(newEvent) => {
          setEvents((prev) => [newEvent, ...prev])
          setShowCreateEvent(false)
        }}
      />
    </div>
  )
}
