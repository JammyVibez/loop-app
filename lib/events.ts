export type EventStatus = "live" | "upcoming" | "ended"

export interface EventBase {
  id: string
  title: string
  description?: string
  starts_at?: string
  start_time?: string
  event_date?: string
  ends_at?: string
  end_time?: string
  is_live?: boolean
  is_active?: boolean
  status?: string
}

/**
 * Calculates unified event status ("live" | "upcoming" | "ended") synchronously
 * based on start/end timestamps and live indicators.
 */
export function getEventStatus(event: EventBase, referenceTime: Date = new Date()): EventStatus {
  if (!event) return "ended"

  // Explicit override checks
  if (event.is_live === true || event.status === "live") {
    return "live"
  }
  if (event.status === "ended" || event.is_active === false) {
    return "ended"
  }

  const startStr = event.starts_at || event.start_time || event.event_date
  if (!startStr) {
    return event.is_active ? "live" : "upcoming"
  }

  const startTime = new Date(startStr).getTime()
  if (isNaN(startTime)) return "upcoming"

  let endTime: number
  const endStr = event.ends_at || event.end_time
  if (endStr) {
    endTime = new Date(endStr).getTime()
  } else {
    // Default duration: 2 hours from start
    endTime = startTime + 2 * 60 * 60 * 1000
  }

  const now = referenceTime.getTime()

  if (now >= startTime && now <= endTime) {
    return "live"
  }
  if (now > endTime) {
    return "ended"
  }
  return "upcoming"
}

/**
 * Human-readable date/time formatter for events
 */
export function formatEventTime(dateStr?: string, status?: EventStatus): string {
  if (status === "live") return "LIVE NOW"
  if (!dateStr) return "Scheduled"

  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return "Scheduled"

  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString()

  const timeString = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  if (isToday) return `Today at ${timeString}`
  if (isTomorrow) return `Tomorrow at ${timeString}`
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeString}`
}

/**
 * Helper to get status badge styling & labels consistently
 */
export function getEventStatusBadge(status: EventStatus) {
  switch (status) {
    case "live":
      return {
        label: "LIVE STAGE",
        className: "bg-rose-500 hover:bg-rose-600 text-white font-bold animate-pulse",
        dot: true,
      }
    case "upcoming":
      return {
        label: "Upcoming",
        className: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-semibold",
        dot: false,
      }
    case "ended":
      return {
        label: "Ended",
        className: "bg-muted text-muted-foreground border border-border font-medium",
        dot: false,
      }
  }
}
