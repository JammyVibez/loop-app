
"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface RealtimeContextType {
  channel: RealtimeChannel | null
  isConnected: boolean
  subscribe: (event: string, callback: (payload: any) => void) => void
  unsubscribe: (event: string) => void
  broadcast: (event: string, payload: any) => void
}

export const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { user } = useAuth()
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const maxRetries = 5

  useEffect(() => {
    if (user?.id) {
      // Create a Supabase realtime channel for the user
      const userChannel = supabase.channel(`user:${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      })

      // Subscribe to the channel
      userChannel
        .on('presence', { event: 'sync' }, () => {
          setIsConnected(true)
          console.log('Connected to Supabase realtime')
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('User joined:', key, newPresences)
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('User left:', key, leftPresences)
        })
        .on('broadcast', { event: 'notification' }, (payload) => {
          console.log('Received notification:', payload)
        })
        .on('broadcast', { event: 'loop_update' }, (payload) => {
          console.log('Loop update:', payload)
        })
        .on('broadcast', { event: 'message' }, (payload) => {
          console.log('New message:', payload)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true)
            // Track user presence
            await userChannel.track({
              user_id: user.id,
              username: user.username,
              online_at: new Date().toISOString()
            })
          }
        })

      setChannel(userChannel)

      return () => {
        userChannel.unsubscribe()
        setChannel(null)
        setIsConnected(false)
      }
    }
  }, [user?.id])

  const subscribe = (event: string, callback: (payload: any) => void) => {
    if (channel) {
      channel.on('broadcast', { event }, callback)
    }
  }

  const unsubscribe = (event: string) => {
    if (channel) {
      channel.off('broadcast', { event })
    }
  }

  const broadcast = (event: string, payload: any) => {
    if (channel) {
      channel.send({
        type: 'broadcast',
        event,
        payload
      })
    }
  }

  return (
    <RealtimeContext.Provider value={{ 
      channel, 
      isConnected, 
      subscribe, 
      unsubscribe, 
      broadcast 
    }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error("useRealtime must be used within a RealtimeProvider")
  }
  return context
}
