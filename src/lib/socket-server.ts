import { createServer } from 'http'
import { Server } from 'socket.io'

// Global reference to prevent multiple instances
declare global {
  var __socketServer: any
  var __socketIO: any
}

type VideoSource = 'youtube' | 'direct' | 'twitch' | 'vimeo' | 'iframe' | 'file' | 'screen'

interface User {
  id: string
  username: string
  color: string
}

interface Room {
  id: string
  users: Map<string, User>
  videoUrl: string
  videoSource: VideoSource
  videoState: 'playing' | 'paused'
  videoTime: number
  playlist: PlaylistItem[]
}

interface PlaylistItem {
  id: string
  url: string
  title: string
  addedBy: string
}

interface ChatMessage {
  id: string
  username: string
  color: string
  content: string
  timestamp: number
  type: 'user' | 'system'
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#D7BDE2'
]

const generateId = () => Math.random().toString(36).substr(2, 9)
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]

export function getSocketIO(): Server | null {
  return globalThis.__socketIO || null
}

export function startSocketServer(): Server {
  if (globalThis.__socketIO) {
    return globalThis.__socketIO
  }

  const httpServer = createServer()
  const io = new Server(httpServer, {
    path: '/',
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  const rooms = new Map<string, Room>()
  const userRoomMap = new Map<string, string>()

  function getOrCreateRoom(roomId: string): Room {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        videoUrl: '',
        videoSource: 'youtube',
        videoState: 'paused',
        videoTime: 0,
        playlist: []
      })
    }
    return rooms.get(roomId)!
  }

  function broadcastRoomUsers(roomId: string) {
    const room = rooms.get(roomId)
    if (!room) return
    const usersList = Array.from(room.users.values())
    io.to(roomId).emit('room-users', { users: usersList })
  }

  function broadcastPlaylist(roomId: string) {
    const room = rooms.get(roomId)
    if (!room) return
    io.to(roomId).emit('playlist-update', { playlist: room.playlist })
  }

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`)

    socket.on('join-room', (data: { roomId: string; username: string }) => {
      const { roomId, username } = data
      console.log(`[Socket] ${username} joining room ${roomId}`)
      const room = getOrCreateRoom(roomId)
      const color = getRandomColor()

      // Leave previous room
      const prevRoom = userRoomMap.get(socket.id)
      if (prevRoom) {
        const prevRoomData = rooms.get(prevRoom)
        if (prevRoomData) {
          prevRoomData.users.delete(socket.id)
          socket.leave(prevRoom)
          broadcastRoomUsers(prevRoom)
          const leaveMsg: ChatMessage = {
            id: generateId(),
            username: 'System',
            color: '#888',
            content: `${username} left the room`,
            timestamp: Date.now(),
            type: 'system'
          }
          io.to(prevRoom).emit('chat-message', leaveMsg)
        }
      }

      // Join new room
      const user: User = { id: socket.id, username, color }
      room.users.set(socket.id, user)
      socket.join(roomId)
      userRoomMap.set(socket.id, roomId)

      socket.emit('room-joined', {
        room: {
          id: room.id,
          videoUrl: room.videoUrl,
          videoSource: room.videoSource,
          videoState: room.videoState,
          videoTime: room.videoTime,
          playlist: room.playlist,
          users: Array.from(room.users.values())
        }
      })

      const joinMsg: ChatMessage = {
        id: generateId(),
        username: 'System',
        color: '#4ECDC4',
        content: `${username} joined the room`,
        timestamp: Date.now(),
        type: 'system'
      }
      io.to(roomId).emit('chat-message', joinMsg)
      broadcastRoomUsers(roomId)
    })

    socket.on('chat-message', (data: { content: string }) => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return
      const user = room.users.get(socket.id)
      if (!user) return

      const message: ChatMessage = {
        id: generateId(),
        username: user.username,
        color: user.color,
        content: data.content,
        timestamp: Date.now(),
        type: 'user'
      }
      io.to(roomId).emit('chat-message', message)
    })

    socket.on('reaction', (data: { emoji: string }) => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return
      const user = room.users.get(socket.id)
      if (!user) return

      io.to(roomId).emit('reaction', {
        emoji: data.emoji,
        username: user.username,
        color: user.color,
        timestamp: Date.now()
      })
    })

    socket.on('video-load', (data: { url: string; source?: string }) => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return

      const username = room.users.get(socket.id)?.username
      console.log(`[Socket] Video load in ${roomId}: ${data.url} (source: ${data.source || 'auto'})`)

      room.videoUrl = data.url
      room.videoSource = (data.source as VideoSource) || 'youtube'
      room.videoTime = 0
      room.videoState = 'paused'

      io.to(roomId).emit('video-load', { url: data.url, source: room.videoSource, username })

      const sourceLabels: Record<string, string> = {
        youtube: 'YouTube',
        direct: 'video',
        twitch: 'Twitch',
        vimeo: 'Vimeo',
        iframe: 'URL',
      }
      const systemMsg: ChatMessage = {
        id: generateId(),
        username: 'System',
        color: '#45B7D1',
        content: `${username || 'Someone'} loaded a ${sourceLabels[room.videoSource] || ''} video`,
        timestamp: Date.now(),
        type: 'system'
      }
      io.to(roomId).emit('chat-message', systemMsg)
    })

    socket.on('video-play', (data: { time: number }) => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return
      room.videoState = 'playing'
      room.videoTime = data.time
      socket.to(roomId).emit('video-play', { time: data.time })
    })

    socket.on('video-pause', (data: { time: number }) => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return
      room.videoState = 'paused'
      room.videoTime = data.time
      socket.to(roomId).emit('video-pause', { time: data.time })
    })

    socket.on('video-seek', (data: { time: number }) => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return
      room.videoTime = data.time
      socket.to(roomId).emit('video-seek', { time: data.time })
    })

    socket.on('playlist-add', (data: { url: string; title: string }) => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return
      const user = room.users.get(socket.id)
      if (!user) return

      room.playlist.push({
        id: generateId(),
        url: data.url,
        title: data.title,
        addedBy: user.username
      })
      broadcastPlaylist(roomId)
    })

    socket.on('playlist-remove', (data: { id: string }) => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return
      room.playlist = room.playlist.filter(item => item.id !== data.id)
      broadcastPlaylist(roomId)
    })

    socket.on('disconnect', () => {
      const roomId = userRoomMap.get(socket.id)
      if (!roomId) return

      const room = rooms.get(roomId)
      if (room) {
        const user = room.users.get(socket.id)
        room.users.delete(socket.id)
        broadcastRoomUsers(roomId)

        if (user) {
          const leaveMsg: ChatMessage = {
            id: generateId(),
            username: 'System',
            color: '#FF6B6B',
            content: `${user.username} left the room`,
            timestamp: Date.now(),
            type: 'system'
          }
          io.to(roomId).emit('chat-message', leaveMsg)
        }

        if (room.users.size === 0) {
          rooms.delete(roomId)
        }
      }
      userRoomMap.delete(socket.id)
    })
  })

  const PORT = 3003
  httpServer.listen(PORT, () => {
    console.log(`[Socket] WatchParty Socket.io server running on port ${PORT}`)
  })

  globalThis.__socketServer = httpServer
  globalThis.__socketIO = io

  return io
}
