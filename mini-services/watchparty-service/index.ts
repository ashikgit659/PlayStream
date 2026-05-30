import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

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

interface User {
  id: string
  username: string
  color: string
}

type VideoSource = 'youtube' | 'direct' | 'twitch' | 'vimeo' | 'iframe' | 'file' | 'screen'

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

interface Reaction {
  emoji: string
  username: string
  color: string
  timestamp: number
}

const rooms = new Map<string, Room>()
const userRoomMap = new Map<string, string>()

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#D7BDE2'
]

const generateId = () => Math.random().toString(36).substr(2, 9)
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]

function detectVideoSource(url: string): VideoSource {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/twitch\.tv/i.test(url)) return 'twitch'
  if (/vimeo\.com/i.test(url)) return 'vimeo'
  if (/dailymotion\.com/i.test(url)) return 'iframe'
  if (/\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv)(\?.*)?$/i.test(url)) return 'direct'
  if (/^https?:\/\//i.test(url)) return 'iframe'
  return 'youtube'
}

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

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`)

  socket.on('join-room', (data: { roomId: string; username: string }) => {
    const { roomId, username } = data
    const room = getOrCreateRoom(roomId)
    const color = getRandomColor()

    // Leave previous room if any
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

    // Send room state to new user
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

    // Notify others
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

    const reaction: Reaction = {
      emoji: data.emoji,
      username: user.username,
      color: user.color,
      timestamp: Date.now()
    }
    io.to(roomId).emit('reaction', reaction)
  })

  socket.on('video-load', (data: { url: string; source?: string }) => {
    const roomId = userRoomMap.get(socket.id)
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return

    room.videoSource = (data.source as VideoSource) || 'youtube'
    room.videoTime = 0
    room.videoState = 'paused'
    const username = room.users.get(socket.id)?.username

    // Handle screen source type - no URL needed, broadcaster shares stream
    if (room.videoSource === 'screen') {
      room.videoUrl = ''
      io.to(roomId).emit('video-load', { url: '', source: 'screen', username, broadcasterId: socket.id })
    } else {
      room.videoUrl = data.url
      io.to(roomId).emit('video-load', { url: data.url, source: room.videoSource, username })
    }

    const sourceLabels: Record<string, string> = {
      youtube: 'YouTube',
      direct: 'video',
      twitch: 'Twitch',
      vimeo: 'Vimeo',
      iframe: 'URL',
      screen: 'Screen',
      file: 'File',
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

    const item: PlaylistItem = {
      id: generateId(),
      url: data.url,
      title: data.title,
      addedBy: user.username
    }
    room.playlist.push(item)
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

  socket.on('playlist-reorder', (data: { playlist: PlaylistItem[] }) => {
    const roomId = userRoomMap.get(socket.id)
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return

    room.playlist = data.playlist
    broadcastPlaylist(roomId)
  })

  socket.on('playlist-play-next', () => {
    const roomId = userRoomMap.get(socket.id)
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return
    if (room.playlist.length === 0) return

    const nextItem = room.playlist.shift()!
    room.videoUrl = nextItem.url
    // Detect source type from URL instead of hardcoding 'youtube'
    const detectedSource = detectVideoSource(nextItem.url)
    room.videoSource = detectedSource
    room.videoTime = 0
    room.videoState = 'paused'

    broadcastPlaylist(roomId)
    const username = room.users.get(socket.id)?.username
    io.to(roomId).emit('video-load', { url: nextItem.url, source: room.videoSource, username })

    const systemMsg: ChatMessage = {
      id: generateId(),
      username: 'System',
      color: '#45B7D1',
      content: `${username || 'Someone'} started playing "${nextItem.title}" from the playlist`,
      timestamp: Date.now(),
      type: 'system'
    }
    io.to(roomId).emit('chat-message', systemMsg)
  })

  socket.on('playlist-clear', () => {
    const roomId = userRoomMap.get(socket.id)
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return

    room.playlist = []
    broadcastPlaylist(roomId)

    const username = room.users.get(socket.id)?.username
    const systemMsg: ChatMessage = {
      id: generateId(),
      username: 'System',
      color: '#FF6B6B',
      content: `${username || 'Someone'} cleared the playlist`,
      timestamp: Date.now(),
      type: 'system'
    }
    io.to(roomId).emit('chat-message', systemMsg)
  })

  socket.on('video-end', () => {
    const roomId = userRoomMap.get(socket.id)
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return

    if (room.playlist.length > 0) {
      const nextItem = room.playlist.shift()!
      room.videoUrl = nextItem.url
      // Detect source type from URL instead of hardcoding 'youtube'
      const detectedSource = detectVideoSource(nextItem.url)
      room.videoSource = detectedSource
      room.videoTime = 0
      room.videoState = 'paused'

      broadcastPlaylist(roomId)
      io.to(roomId).emit('video-load', { url: nextItem.url, source: room.videoSource, username: 'Auto-play' })

      const systemMsg: ChatMessage = {
        id: generateId(),
        username: 'System',
        color: '#96CEB4',
        content: `Auto-playing next: "${nextItem.title}"`,
        timestamp: Date.now(),
        type: 'system'
      }
      io.to(roomId).emit('chat-message', systemMsg)
    } else {
      io.to(roomId).emit('video-ended')

      const systemMsg: ChatMessage = {
        id: generateId(),
        username: 'System',
        color: '#888',
        content: 'Video ended',
        timestamp: Date.now(),
        type: 'system'
      }
      io.to(roomId).emit('chat-message', systemMsg)
    }
  })

  socket.on('video-load-source', (data: { source: 'screen' | 'file'; url?: string }) => {
    const roomId = userRoomMap.get(socket.id)
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return
    const user = room.users.get(socket.id)
    if (!user) return

    if (data.source === 'screen') {
      room.videoSource = 'screen'
      room.videoUrl = ''
      room.videoTime = 0
      room.videoState = 'paused'

      // Broadcaster shares screen, others view it
      io.to(roomId).emit('video-load', { url: '', source: 'screen', username: user.username, broadcasterId: socket.id })

      const systemMsg: ChatMessage = {
        id: generateId(),
        username: 'System',
        color: '#45B7D1',
        content: `${user.username} started sharing their screen`,
        timestamp: Date.now(),
        type: 'system'
      }
      io.to(roomId).emit('chat-message', systemMsg)
    } else if (data.source === 'file') {
      const fileUrl = data.url || ''
      room.videoSource = 'file'
      room.videoUrl = fileUrl
      room.videoTime = 0
      room.videoState = 'paused'

      // File URL shared and played via HTML5 video
      io.to(roomId).emit('video-load', { url: fileUrl, source: 'file', username: user.username })

      const systemMsg: ChatMessage = {
        id: generateId(),
        username: 'System',
        color: '#45B7D1',
        content: `${user.username} shared a file video`,
        timestamp: Date.now(),
        type: 'system'
      }
      io.to(roomId).emit('chat-message', systemMsg)
    }
  })

  socket.on('disconnect', () => {
    const roomId = userRoomMap.get(socket.id)
    if (!roomId) {
      console.log(`User disconnected: ${socket.id}`)
      return
    }

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

      // If the disconnecting user was screen sharing, notify the room
      if (room.videoSource === 'screen' && room.users.size > 0) {
        room.videoSource = 'youtube'
        room.videoUrl = ''
        room.videoState = 'paused'
        room.videoTime = 0
        io.to(roomId).emit('video-load', { url: '', source: 'youtube' })
        const screenEndMsg: ChatMessage = {
          id: generateId(),
          username: 'System',
          color: '#FF6B6B',
          content: 'Screen share ended (broadcaster left)',
          timestamp: Date.now(),
          type: 'system'
        }
        io.to(roomId).emit('chat-message', screenEndMsg)
      }

      // Clean up empty rooms
      if (room.users.size === 0) {
        rooms.delete(roomId)
        console.log(`Room ${roomId} deleted (empty)`)
      }
    }

    userRoomMap.delete(socket.id)
    console.log(`User disconnected: ${socket.id}`)
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const PORT = process.env.PORT || 3003
httpServer.listen(PORT, () => {
  console.log(`[Socket] WatchParty Socket.io server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, ignoring to keep server alive')
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...')
  httpServer.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
