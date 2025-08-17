
"use client"

import { useContext } from "react"
import { RealtimeContext } from "@/providers/realtime-provider"

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error("useRealtime must be used within a RealtimeProvider")
  }
  return context
}

export function useRealtimeSubscription(event: string, callback: (payload: any) => void) {
  const { subscribe, unsubscribe } = useRealtime()
  
  const subscribeToEvent = () => {
    subscribe(event, callback)
  }
  
  const unsubscribeFromEvent = () => {
    unsubscribe(event)
  }
  
  return { subscribeToEvent, unsubscribeFromEvent }
}
