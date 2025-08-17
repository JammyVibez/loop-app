"use client"

import { io, Socket } from 'socket.io-client'

export interface WebSocketEvents {
  // Loop events
  'loop:created': (data: { loop: any; author: any }) => void
  'loop:liked': (data: { loopId: string; userId: string; isLiked: boolean; newCount: number }) => void
  'loop:commented': (data: { loopId: string; comment: any }) => void
  'loop:branched': (data: { parentLoopId: string; newLoop: any }) => void

  // User events
  'user:followed': (data: { followerId: string; followingId: string }) => void
  'user:unfollowed': (data: { followerId: string; followingId: string }) => void
  'user:online': (data: { userId: string; status: 'online' | 'offline' }) => void

  // Notification events
  'notification:new': (data: { notification: any }) => void
  'notification:read': (data: { notificationId: string }) => void

  // Stream events
  'stream:started': (data: { streamId: string; streamer: any }) => void
  'stream:ended': (data: { streamId: string }) => void
  'stream:viewer_joined': (data: { streamId: string; viewerId: string }) => void
  'stream:viewer_left': (data: { streamId: string; viewerId: string }) => void
  'stream:chat_message': (data: { streamId: string; message: any }) => void

  // Circle events
  'circle:message': (data: { circleId: string; message: any }) => void
  'circle:member_joined': (data: { circleId: string; member: any }) => void
  'circle:member_left': (data: { circleId: string; memberId: string }) => void

  // System events
  'system:maintenance': (data: { message: string; scheduledAt?: string }) => void
  'system:announcement': (data: { title: string; message: string; type: 'info' | 'warning' | 'success' }) => void
}

class WebSocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  private eventListeners: Map<string, Set<Function>> = new Map()

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect()
    }
  }

  private connect() {
    if (this.isConnecting || this.socket?.connected) {
      return
    }

    this.isConnecting = true

    try {
      // Get auth token
      const token = localStorage.getItem('auth_token')
      
      this.socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || window.location.origin, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      })

      this.setupEventHandlers()
      this.isConnecting = false
    } catch (error) {
      console.error('WebSocket connection error:', error)
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      
      // Join user-specific room
      const token = localStorage.getItem('auth_token')
      if (token) {
        this.socket?.emit('join:user_room', { token })
      }
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, reconnect manually
        this.scheduleReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.scheduleReconnect()
    })

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    // Setup custom event forwarding
    this.socket.onAny((eventName: string, ...args: any[]) => {
      const listeners = this.eventListeners.get(eventName)
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener(...args)
          } catch (error) {
            console.error(`Error in WebSocket event listener for ${eventName}:`, error)
          }
        })
      }
    })
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      this.connect()
    }, delay)
  }

  // Public methods
  public on<K extends keyof WebSocketEvents>(event: K, listener: WebSocketEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  public off<K extends keyof WebSocketEvents>(event: K, listener: WebSocketEvents[K]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.eventListeners.delete(event)
      }
    }
  }

  public emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event)
    }
  }

  public joinRoom(room: string): void {
    this.emit('join:room', { room })
  }

  public leaveRoom(room: string): void {
    this.emit('leave:room', { room })
  }

  public joinLoopRoom(loopId: string): void {
    this.joinRoom(`loop:${loopId}`)
  }

  public leaveLoopRoom(loopId: string): void {
    this.leaveRoom(`loop:${loopId}`)
  }

  public joinStreamRoom(streamId: string): void {
    this.joinRoom(`stream:${streamId}`)
  }

  public leaveStreamRoom(streamId: string): void {
    this.leaveRoom(`stream:${streamId}`)
  }

  public joinCircleRoom(circleId: string): void {
    this.joinRoom(`circle:${circleId}`)
  }

  public leaveCircleRoom(circleId: string): void {
    this.leaveRoom(`circle:${circleId}`)
  }

  public sendStreamChatMessage(streamId: string, message: string): void {
    this.emit('stream:chat', { streamId, message })
  }

  public sendCircleMessage(circleId: string, message: string): void {
    this.emit('circle:message', { circleId, message })
  }

  public isConnected(): boolean {
    return this.socket?.connected || false
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.eventListeners.clear()
  }

  public reconnect(): void {
    this.disconnect()
    this.reconnectAttempts = 0
    this.connect()
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient && typeof window !== 'undefined') {
    wsClient = new WebSocketClient()
  }
  return wsClient!
}

// React hook for WebSocket
export function useWebSocket() {
  const client = getWebSocketClient()

  return {
    socket: client,
    isConnected: client?.isConnected() || false,
    on: client?.on.bind(client),
    off: client?.off.bind(client),
    emit: client?.emit.bind(client),
    joinRoom: client?.joinRoom.bind(client),
    leaveRoom: client?.leaveRoom.bind(client),
    joinLoopRoom: client?.joinLoopRoom.bind(client),
    leaveLoopRoom: client?.leaveLoopRoom.bind(client),
    joinStreamRoom: client?.joinStreamRoom.bind(client),
    leaveStreamRoom: client?.leaveStreamRoom.bind(client),
    joinCircleRoom: client?.joinCircleRoom.bind(client),
    leaveCircleRoom: client?.leaveCircleRoom.bind(client),
  }
}
