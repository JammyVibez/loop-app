"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import type React from "react"
import { io, type Socket } from "socket.io-client"

interface RealtimeContextType {
  socket: any | null
  isConnected: boolean
}

export const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<any | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    if (user?.token) {
      // For now, we'll create a mock socket to prevent errors
      // In a real implementation, you'd connect to your WebSocket server
      const mockSocket = {
        on: (event: string, callback: Function) => {},
        off: (event: string) => {},
        emit: (event: string, data: any) => {},
      }

      setSocket(mockSocket)
      setIsConnected(true)
    } else {
      // Initialize socket connection when user is not authenticated or token is missing
      const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:3001", {
        transports: ["websocket"],
      })

      socketInstance.on("connect", () => {
        setIsConnected(true)
        console.log("Connected to realtime server")
      })

      socketInstance.on("disconnect", () => {
        setIsConnected(false)
        console.log("Disconnected from realtime server")
      })

      setSocket(socketInstance)

      return () => {
        socketInstance.disconnect()
      }
    }

    return () => {
      setSocket(null)
      setIsConnected(false)
    }
  }, [user?.token])

  return (
    <RealtimeContext.Provider value={{ socket, isConnected }}>
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