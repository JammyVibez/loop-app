"use client"

import { useState, useEffect, useCallback } from "react"
import { getEventStatus, type EventBase, type EventStatus } from "@/lib/events"
import { supabase } from "@/lib/supabase"

/**
 * Hook providing a synchronized global clock tick for event status calculations.
 * Updates every `intervalMs` (default 15 seconds) to prevent layout thrashes.
 */
export function useLiveEventTimer(intervalMs: number = 15000) {
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, intervalMs)

    return () => clearInterval(timer)
  }, [intervalMs])

  const checkStatus = useCallback(
    (event: EventBase): EventStatus => {
      return getEventStatus(event, now)
    },
    [now]
  )

  return { now, checkStatus }
}

/**
 * Shared Hook for fetching and subscribing to global/stage events in real time.
 */
export function useGlobalEventsSync(categoryFilter: string = "all") {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { now, checkStatus } = useLiveEventTimer()

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      const url = categoryFilter && categoryFilter !== "all" 
        ? `/api/events?category=${encodeURIComponent(categoryFilter)}`
        : "/api/events"
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || data.data || [])
      }
    } catch (err) {
      console.error("Failed to sync events:", err)
    } finally {
      setLoading(false)
    }
  }, [categoryFilter])

  useEffect(() => {
    fetchEvents()

    if (!supabase) return

    const channel = supabase
      .channel("global_events_sync_hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        fetchEvents()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "global_events" }, () => {
        fetchEvents()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_participants" }, () => {
        fetchEvents()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchEvents])

  // Process events with consolidated live statuses
  const processedEvents = events.map((evt) => {
    const calculatedStatus = checkStatus(evt)
    return {
      ...evt,
      calculatedStatus,
      is_live: calculatedStatus === "live",
    }
  })

  const liveEvents = processedEvents.filter((e) => e.calculatedStatus === "live")
  const upcomingEvents = processedEvents.filter((e) => e.calculatedStatus === "upcoming")
  const endedEvents = processedEvents.filter((e) => e.calculatedStatus === "ended")

  return {
    events: processedEvents,
    liveEvents,
    upcomingEvents,
    endedEvents,
    loading,
    refetch: fetchEvents,
    now,
  }
}
