import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createServerClient } from './supabase'
import jwt from 'jsonwebtoken'

export class SocketServer {
  private io: SocketIOServer
  private supabase = createServerClient()

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.NEXT_PUBLIC_APP_URL 
          : "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    })

    this.setupMiddleware()
    this.setupEventHandlers()
  }

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token
        if (!token) {
          return next(new Error('Authentication error'))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
        const { data: user } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('id', decoded.sub)
          .single()

        if (!user) {
          return next(new Error('User not found'))
        }

        socket.data.user = user
        next()
      } catch (error) {
        next(new Error('Authentication error'))
      }
    })
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.data.user.username} connected`)

      // Join user to their personal room
      socket.join(`user:${socket.data.user.id}`)

      // Live streaming events
      socket.on('stream:join', async (streamId: string) => {
        socket.join(`stream:${streamId}`)
        
        // Update viewer count
        await this.supabase.rpc('increment_stream_viewers', { stream_id: streamId })
        
        // Notify other viewers
        socket.to(`stream:${streamId}`).emit('viewer:joined', {
          user: {
            id: socket.data.user.id,
            username: socket.data.user.username,
            display_name: socket.data.user.display_name,
            avatar_url: socket.data.user.avatar_url
          }
        })

        // Record viewer join
        await this.supabase
          .from('stream_viewers')
          .insert({
            stream_id: streamId,
            user_id: socket.data.user.id,
            joined_at: new Date().toISOString()
          })
      })

      socket.on('stream:leave', async (streamId: string) => {
        socket.leave(`stream:${streamId}`)
        
        // Update viewer count
        await this.supabase.rpc('decrement_stream_viewers', { stream_id: streamId })
        
        // Update viewer record
        await this.supabase
          .from('stream_viewers')
          .update({ left_at: new Date().toISOString() })
          .eq('stream_id', streamId)
          .eq('user_id', socket.data.user.id)
          .is('left_at', null)
      })

      socket.on('stream:chat', async (data: { streamId: string, message: string }) => {
        const chatMessage = {
          id: crypto.randomUUID(),
          stream_id: data.streamId,
          user_id: socket.data.user.id,
          message: data.message,
          message_type: 'text' as const,
          created_at: new Date().toISOString(),
          user: {
            username: socket.data.user.username,
            display_name: socket.data.user.display_name,
            avatar_url: socket.data.user.avatar_url,
            is_verified: socket.data.user.is_verified
          }
        }

        // Save to database
        await this.supabase
          .from('stream_chat')
          .insert({
            stream_id: data.streamId,
            user_id: socket.data.user.id,
            message: data.message,
            message_type: 'text'
          })

        // Broadcast to all viewers
        this.io.to(`stream:${data.streamId}`).emit('stream:chat', chatMessage)
      })

      socket.on('stream:gift', async (data: { 
        streamId: string, 
        giftId: string, 
        quantity: number,
        message?: string 
      }) => {
        try {
          // Get gift details
          const { data: gift } = await this.supabase
            .from('gifts')
            .select('*')
            .eq('id', data.giftId)
            .single()

          if (!gift) return

          const totalCost = gift.price_coins * data.quantity

          // Check if user has enough coins
          if (socket.data.user.loop_coins < totalCost) {
            socket.emit('error', { message: 'Insufficient coins' })
            return
          }

          // Get stream details
          const { data: stream } = await this.supabase
            .from('live_streams')
            .select('streamer_id')
            .eq('id', data.streamId)
            .single()

          if (!stream) return

          // Process gift transaction
          const { data: transaction } = await this.supabase
            .from('gift_transactions')
            .insert({
              sender_id: socket.data.user.id,
              recipient_id: stream.streamer_id,
              gift_id: data.giftId,
              stream_id: data.streamId,
              quantity: data.quantity,
              total_cost: totalCost,
              message: data.message
            })
            .select()
            .single()

          // Update sender's coins
          await this.supabase
            .from('profiles')
            .update({ loop_coins: socket.data.user.loop_coins - totalCost })
            .eq('id', socket.data.user.id)

          // Add earnings to recipient
          const earningsAmount = Math.floor(totalCost * 0.7) // 70% to streamer
          await this.supabase
            .from('earnings')
            .insert({
              user_id: stream.streamer_id,
              source_type: 'gift',
              source_id: transaction.id,
              amount: earningsAmount,
              currency: 'coins'
            })

          // Update recipient's earnings
          await this.supabase.rpc('add_user_earnings', {
            user_id: stream.streamer_id,
            amount: earningsAmount
          })

          // Broadcast gift to all viewers
          const giftEvent = {
            id: transaction.id,
            sender: {
              username: socket.data.user.username,
              display_name: socket.data.user.display_name,
              avatar_url: socket.data.user.avatar_url
            },
            gift: gift,
            quantity: data.quantity,
            message: data.message,
            created_at: new Date().toISOString()
          }

          this.io.to(`stream:${data.streamId}`).emit('stream:gift', giftEvent)

          // Notify streamer
          this.io.to(`user:${stream.streamer_id}`).emit('earnings:new', {
            amount: earningsAmount,
            source: 'gift',
            from: socket.data.user.display_name
          })

        } catch (error) {
          console.error('Gift processing error:', error)
          socket.emit('error', { message: 'Failed to send gift' })
        }
      })

      // Loop interactions
      socket.on('loop:like', async (loopId: string) => {
        // Broadcast like to followers
        const followers = await this.getFollowers(socket.data.user.id)
        followers.forEach(followerId => {
          socket.to(`user:${followerId}`).emit('notification:new', {
            type: 'like',
            message: `${socket.data.user.display_name} liked a loop`,
            loop_id: loopId
          })
        })
      })

      // Reel interactions
      socket.on('reel:view', async (reelId: string) => {
        await this.supabase.rpc('increment_reel_views', { reel_id: reelId })
      })

      // Typing indicators
      socket.on('typing:start', (data: { conversationId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
          user: socket.data.user.username
        })
      })

      socket.on('typing:stop', (data: { conversationId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
          user: socket.data.user.username
        })
      })

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`User ${socket.data.user.username} disconnected`)
        
        // Update any active stream viewers
        await this.supabase
          .from('stream_viewers')
          .update({ left_at: new Date().toISOString() })
          .eq('user_id', socket.data.user.id)
          .is('left_at', null)
      })
    })
  }

  private async getFollowers(userId: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId)
    
    return data?.map(f => f.follower_id) || []
  }

  public getIO() {
    return this.io
  }
}

export let socketServer: SocketServer | null = null

export function initializeSocket(server: HTTPServer) {
  if (!socketServer) {
    socketServer = new SocketServer(server)
  }
  return socketServer
}
