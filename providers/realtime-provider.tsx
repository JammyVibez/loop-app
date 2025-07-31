"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"

interface RealtimeContextType {
  socket: Socket | null
  isConnected: boolean
}

export const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Initialize socket connection
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
  }, [])

  return <RealtimeContext.Provider value={{ socket, isConnected }}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (context === undefined) {
    throw new Error("useRealtime must be used within a RealtimeProvider")
  }
  return context
}
